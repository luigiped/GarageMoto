// R1.1
import * as Location from 'expo-location'
import type { RoutePoint } from '../types/trip'

const MIN_SPEED_KMH = 2
const MIN_MOVEMENT_M = 5
const MIN_DISTANCE_M = 500    // scarta viaggio < 500m
const MIN_DURATION_S = 60     // scarta viaggio < 1 minuto
const MANUAL_MIN_DISTANCE_M = 50
const MANUAL_MIN_DURATION_S = 10

export type LocationCallback = (point: RoutePoint) => void
export type TripValidationOptions = {
  minDistanceM?: number
  minDurationS?: number
}

let _subscription: Location.LocationSubscription | null = null
let _lastObservedPoint: RoutePoint | null = null
let _lastAcceptedPoint: RoutePoint | null = null

export async function requestLocationPermission(): Promise<boolean> {
  const servicesEnabled = await Location.hasServicesEnabledAsync()
  if (!servicesEnabled) {
    return false
  }

  const { status } = await Location.requestForegroundPermissionsAsync()
  return status === 'granted'
}

export async function startTracking(onPoint: LocationCallback): Promise<void> {
  if (_subscription) return

  _lastObservedPoint = null
  _lastAcceptedPoint = null

  _subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 10,   // nuovo punto ogni 10 metri
      timeInterval: 5000,     // o ogni 5 secondi
    },
    (loc) => {
      const point: RoutePoint = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        ts: loc.timestamp,
        speedKmh: resolveSpeedKmh(loc, _lastObservedPoint),
      }

      const movedSinceAcceptedM = _lastAcceptedPoint
        ? _haversineKm(_lastAcceptedPoint, point) * 1000
        : Infinity

      _lastObservedPoint = point

      // Se il provider GPS non riporta speed in moto, accetta comunque
      // punti con movimento reale tra coordinate.
      if (point.speedKmh < MIN_SPEED_KMH && movedSinceAcceptedM < MIN_MOVEMENT_M) {
        return
      }

      _lastAcceptedPoint = point
      onPoint(point)
    },
  )
}

export function stopTracking(): void {
  _subscription?.remove()
  _subscription = null
  _lastObservedPoint = null
  _lastAcceptedPoint = null
}

/** Calcola distanza totale in km da array di RoutePoint. */
export function calcDistanceKm(points: RoutePoint[]): number {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += _haversineKm(points[i - 1], points[i])
  }
  return total
}

/** Verifica soglie minime — restituisce null se il viaggio è troppo corto. */
export function validateTrip(
  points: RoutePoint[],
  startTs: number,
  endTs: number,
  options: TripValidationOptions = {},
): { distanceKm: number; durationMinutes: number } | null {
  if (points.length < 2) {
    return null
  }

  const distanceKm = calcDistanceKm(points)
  const durationS = (endTs - startTs) / 1000
  const minDistanceM = options.minDistanceM ?? MIN_DISTANCE_M
  const minDurationS = options.minDurationS ?? MIN_DURATION_S

  if (distanceKm * 1000 < minDistanceM) return null
  if (durationS < minDurationS) return null

  return {
    distanceKm,
    durationMinutes: Math.round(durationS / 60),
  }
}

export const MANUAL_TRIP_VALIDATION = {
  minDistanceM: MANUAL_MIN_DISTANCE_M,
  minDurationS: MANUAL_MIN_DURATION_S,
} as const

// Haversine formula per distanza tra due coordinate
function _haversineKm(a: RoutePoint, b: RoutePoint): number {
  const R = 6371
  const dLat = _rad(b.lat - a.lat)
  const dLng = _rad(b.lng - a.lng)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(_rad(a.lat)) * Math.cos(_rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function _rad(deg: number): number {
  return (deg * Math.PI) / 180
}

function resolveSpeedKmh(
  loc: Location.LocationObject,
  previousPoint: RoutePoint | null,
): number {
  const speedMs = loc.coords.speed
  if (typeof speedMs === 'number' && Number.isFinite(speedMs) && speedMs > 0) {
    return speedMs * 3.6
  }

  if (!previousPoint) {
    return 0
  }

  const deltaMs = loc.timestamp - previousPoint.ts
  if (deltaMs <= 0) {
    return 0
  }

  const nextPoint: RoutePoint = {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    ts: loc.timestamp,
    speedKmh: 0,
  }
  const distanceKm = _haversineKm(previousPoint, nextPoint)

  return (distanceKm / (deltaMs / 3600000))
}
