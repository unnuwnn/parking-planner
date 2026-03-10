import axios from 'axios'
import * as turf from '@turf/turf'
import type { ParkingMeter, LadotMeterRaw, DayHours } from './types'

const SOCRATA_BASE_URL = 'https://data.lacity.org/resource/s49e-q6j2.json'
const PAGE_SIZE = 1000

const DAY_NAMES: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

// Parse a time string like "0800" or "08:00" -> "08:00"
function normalizeTime(raw: string | undefined): string {
  if (!raw) return '00:00'
  const cleaned = raw.replace(':', '').padStart(4, '0')
  return `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`
}

// Extract enforcement windows from raw LADOT fields.
// Fields may be shaped like: mon_am_start, mon_am_end, mon_pm_start, mon_pm_end
// or sometimes a single range per day. We consolidate to one entry per day.
function parseDayHours(raw: LadotMeterRaw): DayHours[] {
  const days: DayHours[] = []

  for (const dayKey of Object.keys(DAY_NAMES)) {
    // Try single-range fields first (day_start / day_end)
    const startKey = `${dayKey}_start`
    const endKey = `${dayKey}_end`
    const amStartKey = `${dayKey}_am_start`
    const amEndKey = `${dayKey}_am_end`

    if (raw[startKey] !== undefined || raw[amStartKey] !== undefined) {
      const start = normalizeTime(raw[startKey] ?? raw[amStartKey])
      const end = normalizeTime(raw[endKey] ?? raw[amEndKey])
      days.push({ day: DAY_NAMES[dayKey], start, end })
    }
  }

  // If no structured fields found, fall back to policyname heuristic
  if (days.length === 0 && raw.policyname) {
    const policy = raw.policyname.toLowerCase()
    const allWeekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

    if (policy.includes('mon-fri') || policy.includes('mon - fri')) {
      const timeMatch = policy.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
      let start = '08:00'
      let end = '18:00'
      if (timeMatch) {
        let sh = parseInt(timeMatch[1])
        const sm = timeMatch[2] ?? '00'
        const sap = timeMatch[3]?.toLowerCase()
        if (sap === 'pm' && sh < 12) sh += 12
        if (sap === 'am' && sh === 12) sh = 0

        let eh = parseInt(timeMatch[4])
        const em = timeMatch[5] ?? '00'
        const eap = timeMatch[6]?.toLowerCase()
        if (eap === 'pm' && eh < 12) eh += 12
        if (eap === 'am' && eh === 12) eh = 0

        start = `${String(sh).padStart(2, '0')}:${sm}`
        end = `${String(eh).padStart(2, '0')}:${em}`
      }
      for (const d of allWeekdays) days.push({ day: d, start, end })
    } else if (policy.includes('daily') || policy.includes('7 days')) {
      for (const d of [...allWeekdays, 'Sat', 'Sun']) {
        days.push({ day: d, start: '08:00', end: '20:00' })
      }
    }
  }

  return days
}

// Parse hourly rate from strings like "$1.00", "$1.00-$2.00", "1.00"
function parseRate(raterange: string | undefined): number {
  if (!raterange) return 1.0
  // Take the higher end if a range is given
  const matches = raterange.replace(/\$/g, '').split('-').map((s) => parseFloat(s.trim()))
  const valid = matches.filter((n) => !isNaN(n))
  return valid.length > 0 ? Math.max(...valid) : 1.0
}

// Parse time limit from strings like "2HR", "90 MIN", "1.5"
function parseTimeLimit(timelimit: string | undefined): number {
  if (!timelimit) return 2
  const upper = timelimit.toUpperCase()
  const minMatch = upper.match(/(\d+(?:\.\d+)?)\s*MIN/)
  if (minMatch) return parseFloat(minMatch[1]) / 60
  const hrMatch = upper.match(/(\d+(?:\.\d+)?)\s*HR/)
  if (hrMatch) return parseFloat(hrMatch[1])
  const num = parseFloat(upper)
  return isNaN(num) ? 2 : num
}

function mapRawToMeter(raw: LadotMeterRaw): ParkingMeter | null {
  const lat = parseFloat(raw.lat ?? '')
  const lng = parseFloat(raw.long ?? '')
  if (isNaN(lat) || isNaN(lng)) return null

  const streetAddress = [
    raw.blockface ?? '',
    raw.streetname ?? '',
    raw.crossstreet1 ? `@ ${raw.crossstreet1}` : '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Unknown address'

  return {
    id: raw.spaceid ?? `${lat}_${lng}`,
    space_id: raw.spaceid ?? `${lat}_${lng}`,
    lat,
    lng,
    street_address: streetAddress,
    rate_per_hour: parseRate(raw.raterange),
    time_limit_hours: parseTimeLimit(raw.timelimit),
    day_hours: parseDayHours(raw),
    meter_type: raw.metertypedesc ?? 'Single',
    neighborhood: raw.area_description ?? raw.areaid ?? 'Los Angeles',
  }
}

function getHeaders(): Record<string, string> {
  const token = process.env.SOCRATA_APP_TOKEN ?? process.env.LADOT_APP_TOKEN
  return token ? { 'X-App-Token': token } : {}
}

export async function fetchAllMeters(): Promise<ParkingMeter[]> {
  const meters: ParkingMeter[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const response = await axios.get<LadotMeterRaw[]>(SOCRATA_BASE_URL, {
      headers: getHeaders(),
      params: {
        $limit: PAGE_SIZE,
        $offset: offset,
        $order: ':id',
      },
    })

    const batch = response.data
    for (const raw of batch) {
      const meter = mapRawToMeter(raw)
      if (meter) meters.push(meter)
    }

    if (batch.length < PAGE_SIZE) {
      hasMore = false
    } else {
      offset += PAGE_SIZE
    }
  }

  return meters
}

export async function fetchMetersByRadius(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<ParkingMeter[]> {
  // Convert radius to rough lat/lng bounding box for Socrata query
  const latDelta = radiusMeters / 111320
  const lngDelta = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180))
  const minLat = lat - latDelta
  const maxLat = lat + latDelta
  const minLng = lng - lngDelta
  const maxLng = lng + lngDelta

  // Try bounding box query using lat/long columns
  let response
  try {
    response = await axios.get<LadotMeterRaw[]>(SOCRATA_BASE_URL, {
      headers: getHeaders(),
      params: {
        $limit: PAGE_SIZE,
        $where: `lat >= '${minLat}' AND lat <= '${maxLat}' AND long >= '${minLng}' AND long <= '${maxLng}'`,
      },
    })
  } catch {
    // Try within_circle as secondary fallback
    response = await axios.get<LadotMeterRaw[]>(SOCRATA_BASE_URL, {
      headers: getHeaders(),
      params: {
        $limit: PAGE_SIZE,
        $where: `within_circle(location, ${lat}, ${lng}, ${radiusMeters})`,
      },
    })
  }

  const parsed: ParkingMeter[] = []
  const seenIds = new Set<string>()
  const center = turf.point([lng, lat])

  for (const raw of response.data) {
    const meter = mapRawToMeter(raw)
    if (!meter) continue

    // Deduplicate by space_id
    if (seenIds.has(meter.space_id)) continue
    seenIds.add(meter.space_id)

    // Client-side exact radius filter
    const pt = turf.point([meter.lng, meter.lat])
    const dist = turf.distance(center, pt, { units: 'meters' })
    if (dist <= radiusMeters) parsed.push(meter)
  }

  // If bounding box returned nothing, fetch all and filter client-side
  if (parsed.length === 0) {
    const all = await fetchAllMeters()
    return all.filter((m) => {
      if (seenIds.has(m.space_id)) return false
      const pt = turf.point([m.lng, m.lat])
      const dist = turf.distance(center, pt, { units: 'meters' })
      return dist <= radiusMeters
    })
  }

  return parsed
}
