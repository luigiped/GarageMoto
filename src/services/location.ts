// R1.1
import * as Location from 'expo-location'
import type { RoutePoint } from '../types/trip'

const MIN_SPEED_KMH = 2       // ignora punti sotto 2 km/h (moto ferma)
const MIN_DISTANCE_M = 500    // scarta viaggio < 500m
const MIN_DURATION_S = 60     // scarta viaggio < 1 minuto

export type LocationCallback = (point: RoutePoint) => void

let _subscription: Location.LocationSubscription | null = null

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

  _subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 10,   // nuovo punto ogni 10 metri
      timeInterval: 5000,     // o ogni 5 secondi
    },
    (loc) => {
      const speedMs = loc.coords.speed ?? 0
      const speedKmh = speedMs * 3.6

      // Ignora punti sotto soglia velocità (GPS noise da fermo)
      if (speedKmh < MIN_SPEED_KMH) return

      const point: RoutePoint = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        ts: loc.timestamp,
        speedKmh,
      }
      onPoint(point)
    },
  )
}

export function stopTracking(): void {
  _subscription?.remove()
  _subscription = null
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
): { distanceKm: number; durationMinutes: number } | null {
  const distanceKm = calcDistanceKm(points)
  const durationS = (endTs - startTs) / 1000

  if (distanceKm * 1000 < MIN_DISTANCE_M) return null
  if (durationS < MIN_DURATION_S) return null

  return {
    distanceKm,
    durationMinutes: Math.round(durationS / 60),
  }
}

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
