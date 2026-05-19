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
  loadedVehicleId: string | null
  loadTrips: (vehicleId: string) => Promise<void>
  saveTrip: (data: NewTrip) => Promise<Trip>
  deleteTrip: (id: string) => Promise<void>
  ingestExternalTrip: (trip: Trip) => void
}

export const useTripStore = create<TripStore>((set, get) => ({
  trips: [],
  isLoading: false,
  error: null,
  loadedVehicleId: null,

  loadTrips: async (vehicleId) => {
    set({ isLoading: true, error: null, loadedVehicleId: vehicleId })
    try {
      const trips = await readTripsFromDb(vehicleId)
      set({ trips, isLoading: false })
      void _syncTrips(vehicleId)
    } catch (e) {
      console.error('[tripStore] load:', e)
      set({ isLoading: false, error: 'Errore caricamento viaggi' })
    }
  },

  saveTrip: async (data) => {
    const now = new Date().toISOString()
    const trip: Trip = { ...data, id: createId(), created_at: now, updated_at: now }
    try {
      await persistTripLocally(trip, 1)
      set((state) => ({
        error: null,
        trips: state.loadedVehicleId === trip.vehicle_id
          ? upsertTripInState(state.trips, trip)
          : state.trips,
      }))
      void _pushTrip(trip)
      return trip
    } catch (e) {
      console.error('[tripStore] save:', e)
      set({ error: 'Errore salvataggio viaggio' })
      throw e
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

  ingestExternalTrip: (trip) => {
    set((state) => ({
      trips: state.loadedVehicleId === trip.vehicle_id
        ? upsertTripInState(state.trips, trip)
        : state.trips,
    }))
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

  await refreshLoadedVehicleTrips(vehicleId)
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

async function readTripsFromDb(vehicleId: string): Promise<Trip[]> {
  const db = getDb()
  const rows = await db.getAllAsync<TripRow>(
    'SELECT * FROM trips WHERE vehicle_id=? ORDER BY start_time DESC',
    [vehicleId],
  )

  return Promise.all(
    rows.map(async (row) => {
      const trip = await deserializeTrip(row)
      await migrateTripProtectionRow(db, row)
      return trip
    }),
  )
}

async function persistTripLocally(trip: Trip, syncPending: 0 | 1): Promise<void> {
  const db = getDb()
  const protectedTrip = await protectTripForLocalStorage(trip)
  await db.runAsync(
    `INSERT OR REPLACE INTO trips
     (id,user_id,vehicle_id,start_time,end_time,distance_km,
      duration_minutes,avg_speed_kmh,max_speed_kmh,max_lean_angle_deg,
      max_lean_left_deg,max_lean_right_deg,max_braking_g,route_json,
      notes,created_at,updated_at,sync_pending)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      trip.id,
      trip.user_id,
      trip.vehicle_id,
      trip.start_time,
      trip.end_time,
      trip.distance_km,
      trip.duration_minutes,
      trip.avg_speed_kmh,
      trip.max_speed_kmh,
      trip.max_lean_angle_deg ?? null,
      trip.max_lean_left_deg ?? null,
      trip.max_lean_right_deg ?? null,
      trip.max_braking_g ?? null,
      protectedTrip.route_json,
      protectedTrip.notes,
      trip.created_at,
      trip.updated_at,
      syncPending,
    ],
  )
}

async function refreshLoadedVehicleTrips(vehicleId: string): Promise<void> {
  if (useTripStore.getState().loadedVehicleId !== vehicleId) {
    return
  }

  try {
    const trips = await readTripsFromDb(vehicleId)
    if (useTripStore.getState().loadedVehicleId === vehicleId) {
      useTripStore.setState({ trips })
    }
  } catch (error) {
    console.error('[tripStore] refresh loaded vehicle:', error)
  }
}

function upsertTripInState(trips: Trip[], trip: Trip): Trip[] {
  return [trip, ...trips.filter((item) => item.id !== trip.id)]
    .sort((a, b) => b.start_time.localeCompare(a.start_time))
}
