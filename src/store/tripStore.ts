// R1.1 - store viaggi con fallback locale e sync opzionale
import { create } from 'zustand'
import { getDb } from '../db/client'
import {
  migrateTripProtectionRow,
  protectTripForLocalStorage,
  unprotectTripFromLocalStorage,
} from '../services/tripProtection'
import { supabase } from '../services/supabase'
import { enqueueDelete, flushSyncQueue } from '../services/syncQueue'
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
      const rows = await db.getAllAsync<TripRow>(
        'SELECT * FROM trips WHERE vehicle_id=? ORDER BY start_time DESC',
        [vehicleId],
      )
      const trips = await Promise.all(
        rows.map(async (row) => {
          const trip = await deserializeTrip(row)
          await migrateTripProtectionRow(db, row)
          return trip
        }),
      )
      set({ trips, isLoading: false })
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
      const protectedTrip = await protectTripForLocalStorage(trip)
      await db.runAsync(
        `INSERT INTO trips
         (id,user_id,vehicle_id,start_time,end_time,distance_km,
          duration_minutes,avg_speed_kmh,max_speed_kmh,max_lean_angle_deg,
          max_lean_left_deg,max_lean_right_deg,max_braking_g,route_json,
          notes,created_at,updated_at,sync_pending)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          trip.id, trip.user_id, trip.vehicle_id, trip.start_time,
          trip.end_time, trip.distance_km, trip.duration_minutes,
          trip.avg_speed_kmh, trip.max_speed_kmh, trip.max_lean_angle_deg ?? null,
          trip.max_lean_left_deg ?? null, trip.max_lean_right_deg ?? null, trip.max_braking_g ?? null,
          protectedTrip.route_json, protectedTrip.notes, trip.created_at, trip.updated_at,
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
      await enqueueDelete('trips', id)
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
    id: trip.id,
    user_id: trip.user_id,
    vehicle_id: trip.vehicle_id,
    start_time: trip.start_time,
    end_time: trip.end_time,
    distance_km: trip.distance_km,
    duration_minutes: trip.duration_minutes,
    avg_speed_kmh: trip.avg_speed_kmh,
    max_speed_kmh: trip.max_speed_kmh,
    max_lean_angle_deg: trip.max_lean_angle_deg ?? null,
    max_lean_left_deg: trip.max_lean_left_deg ?? null,
    max_lean_right_deg: trip.max_lean_right_deg ?? null,
    max_braking_g: trip.max_braking_g ?? null,
    route_json: JSON.parse(trip.route_json), // Supabase vuole JSONB
    notes: trip.notes ?? null,
    created_at: trip.created_at,
    updated_at: trip.updated_at,
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

  await flushSyncQueue()
  await _pushPendingTrips(vehicleId)

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('start_time', { ascending: false })
  if (error || !data) return

  const db = getDb()
  for (const t of data) {
    const protectedTrip = await protectTripForLocalStorage({
      route_json: typeof t.route_json === 'string' ? t.route_json : JSON.stringify(t.route_json),
      notes: t.notes ?? null,
    })
    await db.runAsync(
      `INSERT OR REPLACE INTO trips
       (id,user_id,vehicle_id,start_time,end_time,distance_km,
        duration_minutes,avg_speed_kmh,max_speed_kmh,max_lean_angle_deg,
        max_lean_left_deg,max_lean_right_deg,max_braking_g,route_json,
        notes,created_at,updated_at,sync_pending)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
      [
        t.id, t.user_id, t.vehicle_id, t.start_time, t.end_time,
        t.distance_km, t.duration_minutes, t.avg_speed_kmh, t.max_speed_kmh,
        t.max_lean_angle_deg ?? null, t.max_lean_left_deg ?? null, t.max_lean_right_deg ?? null, t.max_braking_g ?? null,
        protectedTrip.route_json,
        protectedTrip.notes,
        t.created_at, t.updated_at,
      ],
    ).catch(console.error)
  }
}

async function _pushPendingTrips(vehicleId: string) {
  const db = getDb()
  const rows = await db.getAllAsync<TripRow>(
    'SELECT * FROM trips WHERE vehicle_id=? AND sync_pending=1 ORDER BY updated_at ASC',
    [vehicleId],
  )

  for (const row of rows) {
    await _pushTrip(await deserializeTrip(row))
  }
}

type TripRow = Trip & { sync_pending?: number }

async function deserializeTrip(row: TripRow): Promise<Trip> {
  const { sync_pending: _syncPending, ...trip } = row
  const unprotected = await unprotectTripFromLocalStorage(trip)
  return {
    ...trip,
    route_json: unprotected.route_json,
    notes: unprotected.notes ?? undefined,
  }
}
