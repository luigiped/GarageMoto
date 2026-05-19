// R1.1

export interface RoutePoint {
  lat: number
  lng: number
  ts: number
  speedKmh: number
  leanAngleDeg?: number
}

export interface Trip {
  id: string
  user_id: string
  vehicle_id: string
  start_time: string
  end_time: string
  distance_km: number
  duration_minutes: number
  avg_speed_kmh: number
  max_speed_kmh: number
  max_lean_angle_deg?: number | null
  max_lean_left_deg?: number | null
  max_lean_right_deg?: number | null
  max_braking_g?: number | null
  route_json: string
  notes?: string
  created_at: string
  updated_at: string
}

export type NewTrip = Omit<Trip, 'id' | 'created_at' | 'updated_at'>
