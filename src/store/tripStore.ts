// R1.1 - store viaggi con fallback locale e sync opzionale
import { create } from 'zustand'
import { getDb } from '../db/client'
import { supabase } from '../services/supabase'
import type { Trip, NewTrip } from '../types/trip'
import { createId } from '../utils/id'

interface TripStore {
  trips: Trip[]
  isLoading: boolean
  error: string | null
  loadTrips: (vehicleId: string) => Promise<void>
  saveTrip: (data: NewTrip) => Promise<void>
  deleteTrip: (id: string) => Promise<void>
}

export const useTripStore = create<TripStore>((set, get) => ({
  trips: [],
  isLoading: false,
  error: null,

  loadTrips: async (vehicleId) => {
    set({ isLoading: true, error: null })
    try {
      const db = getDb()
      const rows = await db.getAllAsync<Trip>(
        'SELECT * FROM trips WHERE vehicle_id=? ORDER BY start_time DESC',
        [vehicleId],
      )
      set({ trips: rows, isLoading: false })
      _syncTrips(vehicleId)
    } catch (e) {
      console.error('[tripStore] load:', e)
      set({ isLoading: false, error: 'Errore caricamento viaggi' })
    }
  },

  saveTrip: async (data) => {
    const now = new Date().toISOString()
    const trip: Trip = { ...data, id: createId(), created_at: now, updated_at: now }
    try {
      const db = getDb()
      await db.runAsync(
        `INSERT INTO trips
         (id,user_id,vehicle_id,start_time,end_time,distance_km,
          duration_minutes,avg_speed_kmh,max_speed_kmh,route_json,
          notes,created_at,updated_at,sync_pending)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          trip.id, trip.user_id, trip.vehicle_id, trip.start_time,
          trip.end_time, trip.distance_km, trip.duration_minutes,
          trip.avg_speed_kmh, trip.max_speed_kmh, trip.route_json,
          trip.notes ?? null, trip.created_at, trip.updated_at,
        ],
      )
      set({ trips: [trip, ...get().trips] })
      _pushTrip(trip)
    } catch (e) {
      console.error('[tripStore] save:', e)
      set({ error: 'Errore salvataggio viaggio' })
    }
  },

  deleteTrip: async (id) => {
    try {
      const db = getDb()
      await db.runAsync('DELETE FROM trips WHERE id=?', [id])
      set({ trips: get().trips.filter(t => t.id !== id) })
      if (supabase) {
        supabase.from('trips').delete().eq('id', id).then(({ error }) => {
          if (error) console.error('[tripStore] delete sync:', error)
        })
      }
    } catch (e) {
      console.error('[tripStore] delete:', e)
      set({ error: 'Errore eliminazione viaggio' })
    }
  },
}))

async function _pushTrip(trip: Trip) {
  if (!supabase) return

  const { error } = await supabase.from('trips').upsert({
    ...trip,
    route_json: JSON.parse(trip.route_json), // Supabase vuole JSONB
  })
  if (error) {
    console.error('[tripStore] sync push:', error)
  } else {
    getDb().runAsync('UPDATE trips SET sync_pending=0 WHERE id=?', [trip.id])
      .catch(console.error)
  }
}

async function _syncTrips(vehicleId: string) {
  if (!supabase) return

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('start_time', { ascending: false })
  if (error || !data) return

  const db = getDb()
  for (const t of data) {
    await db.runAsync(
      `INSERT OR REPLACE INTO trips
       (id,user_id,vehicle_id,start_time,end_time,distance_km,
        duration_minutes,avg_speed_kmh,max_speed_kmh,route_json,
        notes,created_at,updated_at,sync_pending)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
      [
        t.id, t.user_id, t.vehicle_id, t.start_time, t.end_time,
        t.distance_km, t.duration_minutes, t.avg_speed_kmh, t.max_speed_kmh,
        typeof t.route_json === 'string' ? t.route_json : JSON.stringify(t.route_json),
        t.notes ?? null, t.created_at, t.updated_at,
      ],
    ).catch(console.error)
  }
}
