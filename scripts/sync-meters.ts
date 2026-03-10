import { createClient } from '@supabase/supabase-js'
import { fetchAllMeters } from '../lib/ladot'
import type { ParkingMeter } from '../lib/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

async function syncMeters(): Promise<void> {
  console.log('Starting meter sync from LADOT/Socrata...')
  const startTime = Date.now()

  let meters: ParkingMeter[]
  try {
    meters = await fetchAllMeters()
  } catch (err) {
    console.error('Failed to fetch meters from LADOT:', err)
    process.exit(1)
  }

  console.log(`Fetched ${meters.length} meters from LADOT. Upserting to Supabase...`)

  const rows = meters.map((m) => ({
    id: m.id,
    space_id: m.space_id,
    lat: m.lat,
    lng: m.lng,
    street_address: m.street_address,
    rate_per_hour: m.rate_per_hour,
    time_limit_hours: m.time_limit_hours,
    day_hours: m.day_hours,
    meter_type: m.meter_type,
    neighborhood: m.neighborhood,
    synced_at: new Date().toISOString(),
  }))

  const chunks = chunkArray(rows, 500)
  let totalUpserted = 0
  let totalErrors = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const { error } = await supabase
      .from('parking_meters')
      .upsert(chunk, { onConflict: 'space_id' })

    if (error) {
      console.error(`Chunk ${i + 1}/${chunks.length} error:`, error.message)
      totalErrors += chunk.length
    } else {
      totalUpserted += chunk.length
      if (totalUpserted % 500 === 0 || i === chunks.length - 1) {
        console.log(
          `Progress: ${totalUpserted}/${rows.length} upserted` +
            (totalErrors > 0 ? ` (${totalErrors} errors)` : '')
        )
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(
    `\nSync complete in ${elapsed}s. Upserted: ${totalUpserted}, Errors: ${totalErrors}`
  )
}

syncMeters()
