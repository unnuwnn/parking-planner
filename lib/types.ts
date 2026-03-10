export interface DayHours {
  day: string   // e.g. "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"
  start: string // e.g. "08:00"
  end: string   // e.g. "20:00"
}

export interface ParkingMeter {
  id: string
  space_id: string
  lat: number
  lng: number
  street_address: string
  rate_per_hour: number
  time_limit_hours: number
  day_hours: DayHours[]
  meter_type: string
  neighborhood: string
}

export interface SearchParams {
  destination: string
  lat: number
  lng: number
  arrival_time: Date
  duration_hours: number
  walk_radius_meters: number
}

export interface ParkingRecommendation {
  meter: ParkingMeter
  walk_distance_meters: number
  total_cost: number
  score: number
  is_safe: boolean
  risk_flags: string[]
}

// Raw shape from LADOT / Socrata API
export interface LadotMeterRaw {
  spaceid?: string
  blockface?: string
  streetname?: string
  crossstreet1?: string
  crossstreet2?: string
  lat?: string
  long?: string
  raterange?: string
  timelimit?: string
  metertypedesc?: string
  policyname?: string
  streetblockid?: string
  areaid?: string
  area_description?: string
  // Enforcement windows may appear as mon_am_start, mon_am_end, etc.
  [key: string]: string | undefined
}
