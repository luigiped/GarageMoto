export type FuelType = 'benzina' | 'diesel' | 'gpl' | 'elettrico'

export interface Vehicle {
  id: string
  user_id: string
  brand: string
  model: string
  year: number
  displacement_cc?: number
  tank_capacity_l: number
  odometer_start_km: number
  fuel_type: FuelType
  nickname?: string
  color_hex?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type NewVehicle = Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>
