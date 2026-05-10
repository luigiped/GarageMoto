import { create } from 'zustand'
import { getDb } from '../db/client'
import { cancelNotification } from '../services/notifications'
import { removeVehicleImageUri } from '../services/vehicleImageStore'
import { supabase } from '../services/supabase'
import { enqueueDelete, flushSyncQueue } from '../services/syncQueue'
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
      const [refuels, maintenance, trips] = await Promise.all([
        db.getAllAsync<{ id: string }>('SELECT id FROM refuels WHERE vehicle_id=?', [id]),
        db.getAllAsync<{ id: string }>('SELECT id FROM maintenance WHERE vehicle_id=?', [id]),
        db.getAllAsync<{ id: string }>('SELECT id FROM trips WHERE vehicle_id=?', [id]),
      ])

      for (const row of refuels) {
        await enqueueDelete('refuels', row.id)
      }
      for (const row of maintenance) {
        await enqueueDelete('maintenance', row.id)
      }
      for (const row of trips) {
        await enqueueDelete('trips', row.id)
      }
      await enqueueDelete('vehicles', id)

      await db.runAsync('DELETE FROM vehicles WHERE id=?', [id])
      await db.runAsync('DELETE FROM refuels WHERE vehicle_id=?', [id])
      await db.runAsync('DELETE FROM maintenance WHERE vehicle_id=?', [id])
      await db.runAsync('DELETE FROM trips WHERE vehicle_id=?', [id])

      await Promise.all(
        maintenance.map((row) => cancelNotification(row.id).catch(() => null)),
      )
      await removeVehicleImageUri(id).catch((error) => {
        console.warn('[vehicleStore] removeVehicleImageUri:', error)
      })

      const vehicles = get().vehicles.filter(v => v.id !== id)
      set({
        vehicles,
        activeVehicle: get().activeVehicle?.id === id
          ? (vehicles[0] ?? null)
          : get().activeVehicle,
      })

      void deleteVehicleRemote(id)
    } catch (e) {
      console.error('[vehicleStore] deleteVehicle:', e)
      set({ error: 'Errore eliminazione veicolo' })
    }
  },
}))

// ── Helpers sync ──────────────────────────────────────────────────────────────

type VehicleRow = Omit<Vehicle, 'is_active'> & { is_active: number; sync_pending?: number }

function deserializeVehicle(row: VehicleRow): Vehicle {
  const { sync_pending: _syncPending, ...vehicleRow } = row
  return {
    ...vehicleRow,
    is_active: Boolean(vehicleRow.is_active),
  }
}

async function deleteVehicleRemote(vehicleId: string): Promise<void> {
  if (!supabase) {
    return
  }
  const client = supabase

  const steps = [
    () => client.from('refuels').delete().eq('vehicle_id', vehicleId),
    () => client.from('maintenance').delete().eq('vehicle_id', vehicleId),
    () => client.from('trips').delete().eq('vehicle_id', vehicleId),
    () => client.from('vehicles').delete().eq('id', vehicleId),
  ]

  for (const step of steps) {
    const { error } = await step()
    if (error) {
      console.error('[vehicleStore] deleteVehicle sync:', error)
      return
    }
  }
}

async function _pushVehicle(vehicle: Vehicle) {
  if (!supabase) return

  const { error } = await supabase.from('vehicles').upsert({
    id: vehicle.id,
    user_id: vehicle.user_id,
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.year,
    displacement_cc: vehicle.displacement_cc ?? null,
    tank_capacity_l: vehicle.tank_capacity_l,
    odometer_start_km: vehicle.odometer_start_km,
    fuel_type: vehicle.fuel_type,
    nickname: vehicle.nickname ?? null,
    is_active: vehicle.is_active,
    color_hex: vehicle.color_hex ?? null,
    created_at: vehicle.created_at,
    updated_at: vehicle.updated_at,
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

  await flushSyncQueue()
  await _pushPendingVehicles(userId)

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

async function _pushPendingVehicles(userId: string) {
  const db = getDb()
  const rows = await db.getAllAsync<VehicleRow>(
    'SELECT * FROM vehicles WHERE user_id=? AND sync_pending=1 ORDER BY updated_at ASC',
    [userId],
  )

  for (const row of rows) {
    await _pushVehicle(deserializeVehicle(row))
  }
}
