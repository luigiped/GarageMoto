import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { Platform } from 'react-native'
import { ensureDb, getDb } from '../db/client'
import {
  getProtectedJsonFromAsyncStorage,
  removeProtectedItemFromAsyncStorage,
  setProtectedJsonInAsyncStorage,
} from './secureStorage'
import { supabase } from './supabase'
import { useTripStore } from '../store/tripStore'
import { protectTripForLocalStorage } from './tripProtection'
import { createId } from '../utils/id'
import type { NewTrip, RoutePoint, Trip } from '../types/trip'
import { validateTrip } from './location'
import { computeMaxBrakingG } from '../utils/tripMetrics'

const AUTO_TRIP_ENABLED_KEY = 'garagemoto:auto-trip-enabled'
const AUTO_TRIP_CONTEXT_KEY = 'garagemoto:auto-trip-context'
const AUTO_TRIP_SESSION_KEY = 'garagemoto:auto-trip-session'
const AUTO_TRIP_TASK = 'garagemoto-auto-trip-task'

const START_SPEED_KMH = 8
const MIN_MOVING_SPEED_KMH = 2
const AUTO_STOP_IDLE_MS = 3 * 60 * 1000
const MIN_START_MOVEMENT_M = 8

type AutoTripContext = {
  userId: string
  vehicleId: string
}

type AutoTripSession = {
  context: AutoTripContext
  startTs: number
  lastMovementTs: number
  maxSpeedKmh: number
  points: RoutePoint[]
}

type LocationTaskPayload = {
  locations?: Location.LocationObject[]
}

let _lastObservedPoint: RoutePoint | null = null

if (!TaskManager.isTaskDefined(AUTO_TRIP_TASK)) {
  TaskManager.defineTask(AUTO_TRIP_TASK, async ({ data, error }) => {
    if (error) {
      console.error('[autoTrip] task error:', error)
      return
    }

    const payload = data as LocationTaskPayload | undefined
    const locations = payload?.locations ?? []

    if (locations.length === 0) {
      return
    }

    try {
      await processLocationBatch(locations)
    } catch (taskError) {
      console.error('[autoTrip] process batch:', taskError)
    }
  })
}

export async function loadAutoTripEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(AUTO_TRIP_ENABLED_KEY)
  return raw === '1'
}

export async function getAutoTripSession(): Promise<AutoTripSession | null> {
  return getProtectedJsonFromAsyncStorage<AutoTripSession>(AUTO_TRIP_SESSION_KEY)
}

export async function requestAutoTripPermissions(): Promise<boolean> {
  const servicesEnabled = await Location.hasServicesEnabledAsync()
  if (!servicesEnabled) {
    return false
  }

  const foreground = await Location.requestForegroundPermissionsAsync()
  if (foreground.status !== 'granted') {
    return false
  }

  const background = await Location.requestBackgroundPermissionsAsync()
  return background.status === 'granted'
}

export async function setAutoTripEnabled(
  enabled: boolean,
  context: AutoTripContext | null,
): Promise<void> {
  await AsyncStorage.setItem(AUTO_TRIP_ENABLED_KEY, enabled ? '1' : '0')
  await applyAutoTripState(enabled, context)
}

export async function syncAutoTripContext(
  context: AutoTripContext | null,
): Promise<void> {
  if (!context) {
    await removeProtectedItemFromAsyncStorage(AUTO_TRIP_CONTEXT_KEY)
    return
  }

  const previous = await readContext()
  if (previous && previous.vehicleId !== context.vehicleId) {
    await finalizeCurrentSession()
  }

  await setProtectedJsonInAsyncStorage(AUTO_TRIP_CONTEXT_KEY, context)

  if (await loadAutoTripEnabled()) {
    await applyAutoTripState(true, context)
  }
}

export async function finalizeCurrentSession(): Promise<Trip | null> {
  const session = await getAutoTripSession()
  if (!session) {
    return null
  }

  const trip = await saveSessionTrip(session)
  await removeProtectedItemFromAsyncStorage(AUTO_TRIP_SESSION_KEY)
  return trip
}

export async function getIsAutoTripTaskActive(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(AUTO_TRIP_TASK)
}

async function applyAutoTripState(
  enabled: boolean,
  context: AutoTripContext | null,
): Promise<void> {
  if (!enabled || !context) {
    await finalizeCurrentSession()
    const started = await Location.hasStartedLocationUpdatesAsync(AUTO_TRIP_TASK)
    if (started) {
      await Location.stopLocationUpdatesAsync(AUTO_TRIP_TASK)
    }
    return
  }

  await setProtectedJsonInAsyncStorage(AUTO_TRIP_CONTEXT_KEY, context)

  const started = await Location.hasStartedLocationUpdatesAsync(AUTO_TRIP_TASK)
  if (started) {
    return
  }

  await Location.startLocationUpdatesAsync(AUTO_TRIP_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 10,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: false,
    foregroundService: Platform.OS === 'android'
      ? {
          notificationTitle: 'GarageMoto',
          notificationBody: 'Rilevamento automatico viaggi attivo.',
          notificationColor: '#E8611A',
        }
      : undefined,
  })
}

async function processLocationBatch(
  locations: Location.LocationObject[],
): Promise<void> {
  const enabled = await loadAutoTripEnabled()
  const context = await readContext()

  if (!enabled || !context) {
    return
  }

  let session = await getAutoTripSession()

  for (const location of locations) {
    const point = toRoutePoint(location, _lastObservedPoint)
    const movedSinceLastM = _lastObservedPoint ? distanceMeters(_lastObservedPoint, point) : 0
    _lastObservedPoint = point

    if (!session) {
      if (point.speedKmh >= START_SPEED_KMH || movedSinceLastM >= MIN_START_MOVEMENT_M) {
        session = {
          context,
          startTs: point.ts,
          lastMovementTs: point.ts,
          maxSpeedKmh: point.speedKmh,
          points: [point],
        }
        await writeSession(session)
      }
      continue
    }

    if (point.speedKmh >= MIN_MOVING_SPEED_KMH) {
      session = {
        ...session,
        lastMovementTs: point.ts,
        maxSpeedKmh: Math.max(session.maxSpeedKmh, point.speedKmh),
        points: [...session.points, point],
      }
      await writeSession(session)
      continue
    }

    if (point.ts - session.lastMovementTs >= AUTO_STOP_IDLE_MS) {
      await saveSessionTrip(session)
      await removeProtectedItemFromAsyncStorage(AUTO_TRIP_SESSION_KEY)
      session = null
    }
  }
}

async function saveSessionTrip(session: AutoTripSession): Promise<Trip | null> {
  if (session.points.length < 2) {
    return null
  }

  const endTs = session.points[session.points.length - 1]?.ts ?? session.lastMovementTs
  const validated = validateTrip(session.points, session.startTs, endTs)
  if (!validated) {
    return null
  }

  const avgSpeed = session.points.reduce((sum, point) => sum + point.speedKmh, 0) / session.points.length
  const maxBrakingG = computeMaxBrakingG(session.points)
  const newTrip: NewTrip = {
    user_id: session.context.userId,
    vehicle_id: session.context.vehicleId,
    start_time: new Date(session.startTs).toISOString(),
    end_time: new Date(endTs).toISOString(),
    distance_km: validated.distanceKm,
    duration_minutes: validated.durationMinutes,
    avg_speed_kmh: Math.round(avgSpeed * 10) / 10,
    max_speed_kmh: Math.round(session.maxSpeedKmh * 10) / 10,
    max_lean_angle_deg: null,
    max_lean_left_deg: null,
    max_lean_right_deg: null,
    max_braking_g: maxBrakingG,
    route_json: JSON.stringify(session.points),
  }

  return persistTrip(newTrip)
}

async function persistTrip(data: NewTrip): Promise<Trip> {
  const db = await ensureDb()
  const now = new Date().toISOString()
  const trip: Trip = {
    ...data,
    id: createId(),
    created_at: now,
    updated_at: now,
  }
  const protectedTrip = await protectTripForLocalStorage(trip)

  await db.runAsync(
    `INSERT INTO trips
     (id,user_id,vehicle_id,start_time,end_time,distance_km,
      duration_minutes,avg_speed_kmh,max_speed_kmh,max_lean_angle_deg,
      max_lean_left_deg,max_lean_right_deg,max_braking_g,route_json,
      notes,created_at,updated_at,sync_pending)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
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
    ],
  )

  useTripStore.getState().ingestExternalTrip(trip)
  void pushTripToSupabase(trip)

  return trip
}

async function pushTripToSupabase(trip: Trip): Promise<void> {
  if (!supabase) {
    return
  }

  const { error } = await supabase.from('trips').upsert({
    ...trip,
    route_json: JSON.parse(trip.route_json),
  })

  if (error) {
    console.error('[autoTrip] sync push:', error)
    return
  }

  getDb().runAsync('UPDATE trips SET sync_pending=0 WHERE id=?', [trip.id]).catch(console.error)
}

async function writeSession(session: AutoTripSession): Promise<void> {
  await setProtectedJsonInAsyncStorage(AUTO_TRIP_SESSION_KEY, session)
}

async function readContext(): Promise<AutoTripContext | null> {
  return getProtectedJsonFromAsyncStorage<AutoTripContext>(AUTO_TRIP_CONTEXT_KEY)
}

function toRoutePoint(
  location: Location.LocationObject,
  previousPoint: RoutePoint | null,
): RoutePoint {
  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    ts: location.timestamp,
    speedKmh: resolveSpeedKmh(location, previousPoint),
  }
}

function resolveSpeedKmh(
  location: Location.LocationObject,
  previousPoint: RoutePoint | null,
): number {
  const speedMs = location.coords.speed
  if (typeof speedMs === 'number' && Number.isFinite(speedMs) && speedMs > 0) {
    return speedMs * 3.6
  }

  if (!previousPoint) {
    return 0
  }

  const nextPoint: RoutePoint = {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    ts: location.timestamp,
    speedKmh: 0,
  }
  const deltaMs = nextPoint.ts - previousPoint.ts
  if (deltaMs <= 0) {
    return 0
  }

  const distanceKm = distanceMeters(previousPoint, nextPoint) / 1000
  return distanceKm / (deltaMs / 3600000)
}

function distanceMeters(a: RoutePoint, b: RoutePoint): number {
  const R = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}
