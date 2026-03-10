import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { fetchMetersByRadius } from '@/lib/ladot'
import { getRecommendations } from '@/lib/recommendation-engine'
import type { ParkingMeter } from '@/lib/types'

const RecommendBodySchema = z.object({
  destination_lat: z.number().min(-90).max(90),
  destination_lng: z.number().min(-180).max(180),
  arrival_time: z.string().datetime(),
  duration_hours: z.number().min(0.25).max(24),
  walk_radius_meters: z.number().min(50).max(5000),
})

export async function POST(req: NextRequest) {
  // Parse + validate body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = RecommendBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const {
    destination_lat,
    destination_lng,
    arrival_time,
    duration_hours,
    walk_radius_meters,
  } = parsed.data

  let meters: ParkingMeter[] = []

  // 1. Try Supabase nearby_meters RPC first
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('nearby_meters', {
      user_lat: destination_lat,
      user_lng: destination_lng,
      radius_meters: walk_radius_meters,
    })

    if (!error && data && data.length > 0) {
      meters = (data as Array<{
        id: string
        space_id: string
        lat: number
        lng: number
        street_address: string
        rate_per_hour: number
        time_limit_hours: number
        day_hours: Array<{ day: string; start: string; end: string }>
        meter_type: string
        neighborhood: string
      }>).map((row) => ({
        id: row.id,
        space_id: row.space_id,
        lat: row.lat,
        lng: row.lng,
        street_address: row.street_address,
        rate_per_hour: row.rate_per_hour,
        time_limit_hours: row.time_limit_hours,
        day_hours: row.day_hours ?? [],
        meter_type: row.meter_type,
        neighborhood: row.neighborhood,
      }))
    }
  } catch (err) {
    // Supabase unavailable — fall through to LADOT API
    console.warn('Supabase RPC failed, falling back to LADOT API:', err)
  }

  // 2. Fallback: fetch directly from LADOT/Socrata
  if (meters.length === 0) {
    try {
      meters = await fetchMetersByRadius(
        destination_lat,
        destination_lng,
        walk_radius_meters
      )
    } catch (err) {
      console.error('LADOT API fetch failed:', err)
      return NextResponse.json(
        { error: 'Failed to fetch parking data. Please try again.' },
        { status: 500 }
      )
    }
  }

  // 3. Run recommendation engine
  const recommendations = getRecommendations(
    {
      destination: '',
      lat: destination_lat,
      lng: destination_lng,
      arrival_time: new Date(arrival_time),
      duration_hours,
      walk_radius_meters,
    },
    meters
  )

  return NextResponse.json({ recommendations, total_meters_checked: meters.length })
}
