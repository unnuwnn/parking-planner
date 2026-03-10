# Parking Planner

Pre-arrival parking planner for LA. Find legal, affordable parking before you leave — not while you're circling the block.

Built with Next.js 14, Supabase + PostGIS, and Mapbox. Powered by LA Open Data (LADOT metered parking inventory).

## Setup

1. Clone the repo
2. Copy `env.local.example` to `.env.local` and fill in your keys
3. Run the Supabase schema: paste `supabase/schema.sql` into your Supabase SQL editor
4. Seed meter data: `npm run sync:meters`
5. Start the dev server: `npm run dev`

## Keys Required

- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project settings
- `SUPABASE_SERVICE_ROLE_KEY` — for sync script only
- `NEXT_PUBLIC_MAPBOX_TOKEN` — mapbox.com
- `SOCRATA_APP_TOKEN` — data.lacity.org (optional, raises rate limits)
