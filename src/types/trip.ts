// R1.1

export interface RoutePoint {
  lat: number
  lng: number
  ts: number        // timestamp Unix ms
  speedKmh: number
}

export interface Trip {
  id: string
  user_id: string
  vehicle_id: string
  start_time: string        // ISO8601
  end_time: string
  distance_km: number
  duration_minutes: number
  avg_speed_kmh: number
  max_speed_kmh: number
  route_json: string        // JSON stringificato di RoutePoint[]
  notes?: string
  created_at: string
  updated_at: string
}

export type NewTrip = Omit<Trip, 'id' | 'created_at' | 'updated_at'>
