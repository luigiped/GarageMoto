import { create } from 'zustand'
import { getDb } from '../db/client'
import { supabase } from '../services/supabase'
import {
  lastFillConsumption,
  costPerKm,
} from '../utils/fuelCalculator'
import type { Refuel, NewRefuel } from '../types/refuel'
import { createId } from '../utils/id'

interface RefuelStore {
  refuels: Refuel[]
  isLoading: boolean
  error: string | null
  loadRefuels: (vehicleId: string) => Promise<void>
  addRefuel: (data: Omit<NewRefuel, 'km_driven' | 'km_per_liter' | 'cost_per_km'>) => Promise<string | null>
  deleteRefuel: (id: string) => Promise<void>
}

export const useRefuelStore = create<RefuelStore>((set, get) => ({
  refuels: [],
  isLoading: false,
  error: null,

  loadRefuels: async (vehicleId) => {
    set({ isLoading: true, error: null })
    try {
      const db = getDb()
      const rows = await db.getAllAsync<Refuel>(
        'SELECT * FROM refuels WHERE vehicle_id=? ORDER BY odometer_km DESC',
        [vehicleId],
      )
      const refuels = rows.map(r => ({
        ...r,
        is_full_tank: Boolean((r as unknown as { is_full_tank: number }).is_full_tank),
      }))
      set({ refuels, isLoading: false })
      _syncRefuels(vehicleId)
    } catch (e) {
      console.error('[refuelStore] loadRefuels:', e)
      set({ isLoading: false, error: 'Errore caricamento rifornimenti' })
    }
  },

  addRefuel: async (data) => {
    set({ error: null })
    const now = new Date().toISOString()
    const sorted = get().refuels
    const previous = sorted[0]
    const km_driven = previous
      ? data.odometer_km - previous.odometer_km
      : undefined
    const canComputeConsumption =
      Boolean(data.is_full_tank) &&
      Boolean(previous?.is_full_tank) &&
      Boolean(km_driven && km_driven > 0)
    const km_per_liter = canComputeConsumption && previous
      ? lastFillConsumption(
          data.odometer_km,
          previous.odometer_km,
          data.liters,
          data.is_full_tank,
        ) ?? undefined
      : undefined
    const cost_per_km =
      km_driven && km_driven > 0
        ? costPerKm(data.amount_eur, km_driven) ?? undefined
        : undefined

    const refuel: Refuel = {
      ...data,
      id: createId(),
      km_driven,
      km_per_liter,
      cost_per_km,
      created_at: now,
      updated_at: now,
    }

    try {
      const db = getDb()
      await db.runAsync(
        `INSERT INTO refuels
         (id,user_id,vehicle_id,date,odometer_km,liters,amount_eur,
          is_full_tank,notes,km_driven,km_per_liter,cost_per_km,
          created_at,updated_at,sync_pending)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          refuel.id, refuel.user_id, refuel.vehicle_id, refuel.date,
          refuel.odometer_km, refuel.liters, refuel.amount_eur,
          refuel.is_full_tank ? 1 : 0, refuel.notes ?? null,
          refuel.km_driven ?? null, refuel.km_per_liter ?? null,
          refuel.cost_per_km ?? null, refuel.created_at, refuel.updated_at,
        ],
      )
      set({ refuels: [refuel, ...get().refuels] })
      _pushRefuel(refuel)
      return refuel.km_per_liter != null
        ? refuel.km_per_liter.toFixed(1)
        : null
    } catch (e) {
      console.error('[refuelStore] addRefuel:', e)
      set({ error: 'Errore salvataggio rifornimento' })
      return null
    }
  },

  deleteRefuel: async (id) => {
    try {
      const db = getDb()
      await db.runAsync('DELETE FROM refuels WHERE id=?', [id])
      set({ refuels: get().refuels.filter(r => r.id !== id) })
      if (supabase) {
        supabase.from('refuels').delete().eq('id', id).then(({ error }) => {
          if (error) console.error('[refuelStore] deleteRefuel sync:', error)
        })
      }
    } catch (e) {
      console.error('[refuelStore] deleteRefuel:', e)
      set({ error: 'Errore eliminazione rifornimento' })
    }
  },
}))

async function _pushRefuel(refuel: Refuel) {
  if (!supabase) return

  const { error } = await supabase.from('refuels').upsert({
    ...refuel,
    is_full_tank: refuel.is_full_tank,
  })
  if (error) {
    console.error('[refuelStore] sync push:', error)
  } else {
    getDb().runAsync('UPDATE refuels SET sync_pending=0 WHERE id=?', [refuel.id])
      .catch(console.error)
  }
}

async function _syncRefuels(vehicleId: string) {
  if (!supabase) return

  const { data, error } = await supabase
    .from('refuels')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('odometer_km', { ascending: false })
  if (error || !data) return

  const db = getDb()
  for (const r of data) {
    await db.runAsync(
      `INSERT OR REPLACE INTO refuels
       (id,user_id,vehicle_id,date,odometer_km,liters,amount_eur,
        is_full_tank,notes,km_driven,km_per_liter,cost_per_km,
        created_at,updated_at,sync_pending)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
      [
        r.id, r.user_id, r.vehicle_id, r.date, r.odometer_km,
        r.liters, r.amount_eur, r.is_full_tank ? 1 : 0,
        r.notes ?? null, r.km_driven ?? null, r.km_per_liter ?? null,
        r.cost_per_km ?? null, r.created_at, r.updated_at,
      ],
    ).catch(console.error)
  }
}
