import { NextRequest, NextResponse } from 'next/server'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim()

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter: q' }, { status: 400 })
  }

  if (!MAPBOX_TOKEN) {
    return NextResponse.json({ error: 'Mapbox token not configured' }, { status: 500 })
  }

  const encoded = encodeURIComponent(query)
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json`
  )
  url.searchParams.set('access_token', MAPBOX_TOKEN)
  url.searchParams.set('country', 'us')
  url.searchParams.set('proximity', '-118.2437,34.0522')
  url.searchParams.set('limit', '5')
  url.searchParams.set('types', 'address,poi,neighborhood,place')

  try {
    const res = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 300 }, // cache geocode results for 5 minutes
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('Mapbox geocoding error:', res.status, text)
      return NextResponse.json(
        { error: 'Geocoding service error', status: res.status },
        { status: 502 }
      )
    }

    const data = await res.json()

    // Return only the features array to keep response lean
    return NextResponse.json(
      { features: data.features ?? [] },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (err) {
    console.error('Geocode fetch failed:', err)
    return NextResponse.json(
      { error: 'Failed to reach geocoding service' },
      { status: 500 }
    )
  }
}
