import * as turf from '@turf/turf'
import { getDay, getHours, getMinutes } from 'date-fns'
import type { ParkingMeter, ParkingRecommendation, SearchParams, DayHours } from './types'

// Map date-fns getDay() (0=Sun) to short day names
const DAY_INDEX_TO_SHORT: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

function arrivalMinutes(date: Date): number {
  return getHours(date) * 60 + getMinutes(date)
}

function departureMinutes(arrivalDate: Date, durationHours: number): number {
  return arrivalMinutes(arrivalDate) + durationHours * 60
}

/**
 * Returns the DayHours entry for the arrival day, if any.
 */
function getEnforcementWindow(
  dayHours: DayHours[],
  arrivalDate: Date
): DayHours | null {
  const dayName = DAY_INDEX_TO_SHORT[getDay(arrivalDate)]
  return dayHours.find((d) => d.day === dayName) ?? null
}

/**
 * Check whether a meter is LEGALLY parkable for the given arrival + duration.
 * Returns an array of risk flags (empty = fully legal).
 */
function checkLegality(
  meter: ParkingMeter,
  params: SearchParams
): { legal: boolean; flags: string[] } {
  const flags: string[] = []
  const dayName = DAY_INDEX_TO_SHORT[getDay(params.arrival_time)]
  const window = getEnforcementWindow(meter.day_hours, params.arrival_time)

  // No enforcement data -> assume no restriction (flag as uncertain)
  if (meter.day_hours.length === 0) {
    return { legal: true, flags: ['No schedule data - verify signs'] }
  }

  // No enforcement on this day -> free parking!
  if (!window) {
    return { legal: true, flags: [] }
  }

  const enforcementStart = timeToMinutes(window.start)
  const enforcementEnd = timeToMinutes(window.end)
  const arrival = arrivalMinutes(params.arrival_time)
  const departure = departureMinutes(params.arrival_time, params.duration_hours)

  // If arrival is outside enforcement window, legal
  if (arrival >= enforcementEnd || departure <= enforcementStart) {
    return { legal: true, flags: [] }
  }

  // We are inside the enforcement window - check time limit
  const effectiveStart = Math.max(arrival, enforcementStart)
  const effectiveEnd = Math.min(departure, enforcementEnd)
  const enforcedMinutes = effectiveEnd - effectiveStart
  const enforcedHours = enforcedMinutes / 60

  if (meter.time_limit_hours < enforcedHours) {
    flags.push(
      `Time limit too short (${meter.time_limit_hours}h limit, need ${enforcedHours.toFixed(1)}h)`
    )
  }

  if (enforcementEnd < departure && enforcementEnd > arrival) {
    flags.push(`Meter ends at ${window.end} - move car before your visit ends`)
  }

  const legal = flags.length === 0 || !flags.some((f) => f.startsWith('Time limit'))
  return { legal, flags }
}

/**
 * Compute walking distance in meters between two lat/lng points.
 */
function walkDistance(
  destLat: number,
  destLng: number,
  meterLat: number,
  meterLng: number
): number {
  const from = turf.point([destLng, destLat])
  const to = turf.point([meterLng, meterLat])
  return turf.distance(from, to, { units: 'meters' })
}

/**
 * Score a meter candidate.
 */
function scoreMeter(
  meter: ParkingMeter,
  walkMeters: number,
  params: SearchParams,
  flags: string[]
): number {
  let score = 100
  score -= Math.floor(walkMeters / 10)
  const rateOverBase = Math.max(0, meter.rate_per_hour - 2)
  score -= rateOverBase * 10
  if (meter.time_limit_hours >= params.duration_hours + 1) {
    score += 20
  }
  if (flags.some((f) => f.startsWith('Time limit'))) {
    score -= 30
  }
  return Math.max(0, Math.round(score))
}

export function getRecommendations(
  params: SearchParams,
  meters: ParkingMeter[]
): ParkingRecommendation[] {
  const results: ParkingRecommendation[] = []

  for (const meter of meters) {
    const walkMeters = walkDistance(params.lat, params.lng, meter.lat, meter.lng)
    if (walkMeters > params.walk_radius_meters) continue

    const { legal, flags } = checkLegality(meter, params)
    const score = scoreMeter(meter, walkMeters, params, flags)
    const totalCost = meter.rate_per_hour * params.duration_hours

    results.push({
      meter,
      walk_distance_meters: Math.round(walkMeters),
      total_cost: Math.round(totalCost * 100) / 100,
      score,
      is_safe: legal,
      risk_flags: flags,
    })
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.walk_distance_meters - b.walk_distance_meters
  })

  return results.slice(0, 10)
}
