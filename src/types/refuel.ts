export interface Refuel {
  id: string
  user_id: string
  vehicle_id: string
  date: string           // ISO date: YYYY-MM-DD
  odometer_km: number
  liters: number
  amount_eur: number
  is_full_tank: boolean
  notes?: string
  km_driven?: number
  km_per_liter?: number
  cost_per_km?: number
  created_at: string
  updated_at: string
}

export type NewRefuel = Omit<Refuel, 'id' | 'created_at' | 'updated_at'>
