import { create } from 'zustand'
import { getDb } from '../db/client'
import { supabase } from '../services/supabase'
import type { Vehicle, NewVehicle } from '../types/vehicle'
import { createId } from '../utils/id'

interface VehicleStore {
  vehicles: Vehicle[]
  activeVehicle: Vehicle | null
  isLoading: boolean
  error: string | null
  loadVehicles: (userId: string) => Promise<void>
  addVehicle: (data: NewVehicle) => Promise<void>
  updateVehicle: (id: string, data: Partial<Vehicle>) => Promise<void>
  deleteVehicle: (id: string) => Promise<void>
  setActiveVehicle: (vehicle: Vehicle) => void
}

export const useVehicleStore = create<VehicleStore>((set, get) => ({
  vehicles: [],
  activeVehicle: null,
  isLoading: false,
  error: null,

  setActiveVehicle: (vehicle) => set({ activeVehicle: vehicle }),

  loadVehicles: async (userId) => {
    set({ isLoading: true, error: null })
    try {
      const db = getDb()
      const rows = await db.getAllAsync<VehicleRow>(
        'SELECT * FROM vehicles WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC',
        [userId],
      )
      const vehicles = rows.map(deserializeVehicle)
      set({
        vehicles,
        activeVehicle: vehicles[0] ?? null,
        isLoading: false,
      })
      // Sync in background — non blocca la UI
      _syncVehicles(userId)
    } catch (e) {
      console.error('[vehicleStore] loadVehicles:', e)
      set({ isLoading: false, error: 'Errore caricamento veicoli' })
    }
  },

  addVehicle: async (data) => {
    set({ error: null })
    const now = new Date().toISOString()
    const vehicle: Vehicle = {
      ...data,
      id: createId(),
      created_at: now,
      updated_at: now,
    }
    try {
      const db = getDb()
      await db.runAsync(
        `INSERT INTO vehicles
         (id,user_id,brand,model,year,displacement_cc,tank_capacity_l,
          odometer_start_km,fuel_type,nickname,color_hex,is_active,
          created_at,updated_at,sync_pending)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          vehicle.id, vehicle.user_id, vehicle.brand, vehicle.model,
          vehicle.year, vehicle.displacement_cc ?? null,
          vehicle.tank_capacity_l, vehicle.odometer_start_km,
          vehicle.fuel_type, vehicle.nickname ?? null,
          vehicle.color_hex ?? null, 1,
          vehicle.created_at, vehicle.updated_at,
        ],
      )
      const vehicles = [vehicle, ...get().vehicles]
      set({ vehicles, activeVehicle: vehicle })
      _pushVehicle(vehicle)
    } catch (e) {
      console.error('[vehicleStore] addVehicle:', e)
      set({ error: 'Errore salvataggio veicolo' })
    }
  },

  updateVehicle: async (id, data) => {
    const now = new Date().toISOString()
    try {
      const currentVehicle = get().vehicles.find(v => v.id === id)
      if (!currentVehicle) {
        set({ error: 'Veicolo non trovato' })
        return
      }

      const nextVehicle: Vehicle = {
        ...currentVehicle,
        ...data,
        updated_at: now,
      }

      const db = getDb()
      await db.runAsync(
        `UPDATE vehicles SET brand=?,model=?,year=?,displacement_cc=?,
         tank_capacity_l=?,odometer_start_km=?,fuel_type=?,nickname=?,
         color_hex=?,updated_at=?,sync_pending=1 WHERE id=?`,
        [
          nextVehicle.brand, nextVehicle.model, nextVehicle.year,
          nextVehicle.displacement_cc ?? null, nextVehicle.tank_capacity_l,
          nextVehicle.odometer_start_km, nextVehicle.fuel_type,
          nextVehicle.nickname ?? null, nextVehicle.color_hex ?? null, now, id,
        ],
      )
      const vehicles = get().vehicles.map(v =>
        v.id === id ? nextVehicle : v,
      )
      const activeVehicle = get().activeVehicle?.id === id
        ? nextVehicle
        : get().activeVehicle
      set({ vehicles, activeVehicle })
      _pushVehicle(nextVehicle)
    } catch (e) {
      console.error('[vehicleStore] updateVehicle:', e)
      set({ error: 'Errore aggiornamento veicolo' })
    }
  },

  deleteVehicle: async (id) => {
    try {
      const db = getDb()
      await db.runAsync('DELETE FROM vehicles WHERE id=?', [id])
      await db.runAsync('DELETE FROM refuels WHERE vehicle_id=?', [id])
      await db.runAsync('DELETE FROM maintenance WHERE vehicle_id=?', [id])
      await db.runAsync('DELETE FROM trips WHERE vehicle_id=?', [id])
      const vehicles = get().vehicles.filter(v => v.id !== id)
      set({
        vehicles,
        activeVehicle: get().activeVehicle?.id === id
          ? (vehicles[0] ?? null)
          : get().activeVehicle,
      })
      if (supabase) {
        supabase.from('vehicles').delete().eq('id', id).then(({ error }) => {
          if (error) console.error('[vehicleStore] deleteVehicle sync:', error)
        })
      }
    } catch (e) {
      console.error('[vehicleStore] deleteVehicle:', e)
      set({ error: 'Errore eliminazione veicolo' })
    }
  },
}))

// ── Helpers sync ──────────────────────────────────────────────────────────────

type VehicleRow = Omit<Vehicle, 'is_active'> & { is_active: number }

function deserializeVehicle(row: VehicleRow): Vehicle {
  return {
    ...row,
    is_active: Boolean(row.is_active),
  }
}

async function _pushVehicle(vehicle: Vehicle) {
  if (!supabase) return

  const { error } = await supabase.from('vehicles').upsert({
    ...vehicle,
    displacement_cc: vehicle.displacement_cc ?? null,
    nickname: vehicle.nickname ?? null,
    color_hex: vehicle.color_hex ?? null,
  })
  if (error) {
    console.error('[vehicleStore] sync push:', error)
  } else {
    getDb().runAsync('UPDATE vehicles SET sync_pending=0 WHERE id=?', [vehicle.id])
      .catch(console.error)
  }
}

async function _syncVehicles(userId: string) {
  if (!supabase) return

  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
  if (error || !data) return

  const db = getDb()
  for (const v of data) {
    await db.runAsync(
      `INSERT OR REPLACE INTO vehicles
       (id,user_id,brand,model,year,displacement_cc,tank_capacity_l,
        odometer_start_km,fuel_type,nickname,color_hex,is_active,
        created_at,updated_at,sync_pending)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
      [
        v.id, v.user_id, v.brand, v.model, v.year,
        v.displacement_cc ?? null, v.tank_capacity_l, v.odometer_start_km,
        v.fuel_type, v.nickname ?? null, v.color_hex ?? null,
        v.is_active ? 1 : 0, v.created_at, v.updated_at,
      ],
    ).catch(console.error)
  }
}
