-- Enable PostGIS extension for geographic queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- parking_meters table
-- ============================================================
CREATE TABLE IF NOT EXISTS parking_meters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id        text UNIQUE NOT NULL,
  lat             double precision NOT NULL,
  lng             double precision NOT NULL,
  location        geography(Point, 4326),
  street_address  text,
  rate_per_hour   numeric(6, 2) DEFAULT 1.00,
  time_limit_hours numeric(4, 1) DEFAULT 2.0,
  day_hours       jsonb DEFAULT '[]'::jsonb,
  meter_type      text DEFAULT 'Single',
  neighborhood    text,
  synced_at       timestamptz DEFAULT now()
);

-- Automatically populate the geography column from lat/lng on insert or update
CREATE OR REPLACE FUNCTION parking_meters_set_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_parking_meters_location ON parking_meters;
CREATE TRIGGER trg_parking_meters_location
  BEFORE INSERT OR UPDATE OF lat, lng
  ON parking_meters
  FOR EACH ROW
  EXECUTE FUNCTION parking_meters_set_location();

-- Spatial index for fast radius queries
CREATE INDEX IF NOT EXISTS idx_parking_meters_location
  ON parking_meters
  USING GIST (location);

-- Index for space_id lookups (e.g. upserts)
CREATE INDEX IF NOT EXISTS idx_parking_meters_space_id
  ON parking_meters (space_id);

-- Index for neighborhood filtering
CREATE INDEX IF NOT EXISTS idx_parking_meters_neighborhood
  ON parking_meters (neighborhood);

-- ============================================================
-- Helper RPC: nearby_meters
-- Returns all parking meters within `radius_meters` of the
-- supplied (user_lat, user_lng) coordinate.
-- ============================================================
CREATE OR REPLACE FUNCTION nearby_meters(
  user_lat      double precision,
  user_lng      double precision,
  radius_meters double precision DEFAULT 800
)
RETURNS SETOF parking_meters
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM   parking_meters
  WHERE  ST_DWithin(
           location,
           ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
           radius_meters
         )
  ORDER BY
    ST_Distance(
      location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) ASC;
$$;

-- Grant execute to anon and authenticated roles (adjust as needed)
GRANT EXECUTE ON FUNCTION nearby_meters(double precision, double precision, double precision)
  TO anon, authenticated;

-- Row-level security (enable but allow read-all for public data)
ALTER TABLE parking_meters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON parking_meters
  FOR SELECT
  USING (true);
