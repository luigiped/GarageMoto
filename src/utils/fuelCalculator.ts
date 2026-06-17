import type { Refuel } from '../types/refuel'
import type { Trip } from '../types/trip'
import { firstDayOfMonth, toLocalISODate } from './dateRanges'

/** km/l dell'ultimo pieno completo. null se parziale o dati invalidi. */
export function lastFillConsumption(
  currentOdometer: number,
  previousOdometer: number,
  litersAdded: number,
  isFullTank: boolean,
): number | null {
  if (!isFullTank) return null
  const km = currentOdometer - previousOdometer
  if (km <= 0 || litersAdded <= 0) return null
  return km / litersAdded
}

/** Media ponderata km/l su tutti i pieni completi. null se < 2 pieni. */
export function averageConsumption(refuels: Refuel[]): number | null {
  const full = refuels.filter(r => r.is_full_tank).sort(
    (a, b) => a.odometer_km - b.odometer_km,
  )
  if (full.length < 2) return null

  let totalKm = 0
  let totalL = 0
  for (let i = 1; i < full.length; i++) {
    const km = full[i].odometer_km - full[i - 1].odometer_km
    if (km > 0) {
      totalKm += km
      totalL += full[i].liters
    }
  }
  return totalL > 0 ? totalKm / totalL : null
}

/** Autonomia stimata in km basata sull'ultimo pieno e la media consumi. */
export function estimatedRange(
  tankCapacityL: number,
  refuels: Refuel[],
  currentOdometerKm: number,
): number | null {
  if (!refuels.length) return null
  const avg = averageConsumption(refuels)
  if (!avg || avg <= 0) return null

  const lastFull = [...refuels]
    .sort((a, b) => b.odometer_km - a.odometer_km)
    .find(r => r.is_full_tank)
  if (!lastFull) return null

  const kmSince = currentOdometerKm - lastFull.odometer_km
  const litersUsed = Math.max(0, kmSince / avg)
  const litersLeft = Math.max(0, Math.min(tankCapacityL, tankCapacityL - litersUsed))
  return litersLeft * avg
}

/** Percentuale carburante stimata (0.0 → 1.0). */
export function estimatedFuelPct(
  tankCapacityL: number,
  estimatedRangeKm: number,
  avgKmL: number,
): number {
  if (avgKmL <= 0) return 0
  return Math.min(1, Math.max(0, (estimatedRangeKm / avgKmL) / tankCapacityL))
}

export type CurrentFuelRangeSource = 'manual_odometer' | 'gps' | 'last_refuel' | 'none'

export interface CurrentFuelRange {
  lastFullRefuel: Refuel | null
  kmSinceLastFull: number | null
  averageKmPerLiter: number | null
  estimatedRangeKm: number | null
  estimatedLitersUsed: number | null
  estimatedLitersLeft: number | null
  currentOdometerKm: number | null
  gpsDistanceKm: number
  source: CurrentFuelRangeSource
  isEstimate: boolean
}

export function currentFuelRange(
  tankCapacityL: number,
  refuels: Refuel[],
  trips: Trip[],
  manualCurrentOdometerKm?: number | null,
): CurrentFuelRange {
  const averageKmPerLiter = averageConsumption(refuels)
  const lastFullRefuel = [...refuels]
    .sort((a, b) => b.odometer_km - a.odometer_km)
    .find(r => r.is_full_tank) ?? null
  const latestKnownOdometerKm = refuels.reduce(
    (max, refuel) => Math.max(max, refuel.odometer_km),
    lastFullRefuel?.odometer_km ?? 0,
  )

  if (!lastFullRefuel || !averageKmPerLiter || averageKmPerLiter <= 0 || tankCapacityL <= 0) {
    return {
      lastFullRefuel,
      kmSinceLastFull: null,
      averageKmPerLiter,
      estimatedRangeKm: null,
      estimatedLitersUsed: null,
      estimatedLitersLeft: null,
      currentOdometerKm: null,
      gpsDistanceKm: 0,
      source: 'none',
      isEstimate: false,
    }
  }

  const validManualOdometer =
    typeof manualCurrentOdometerKm === 'number' &&
    Number.isFinite(manualCurrentOdometerKm) &&
    manualCurrentOdometerKm >= latestKnownOdometerKm
      ? manualCurrentOdometerKm
      : null
  const gpsDistanceKm = trips
    .filter((trip) => trip.start_time.slice(0, 10) >= lastFullRefuel.date)
    .reduce((sum, trip) => sum + Math.max(0, trip.distance_km), 0)
  const latestKnownDistanceKm = Math.max(0, latestKnownOdometerKm - lastFullRefuel.odometer_km)
  const gpsCurrentOdometerKm = lastFullRefuel.odometer_km + gpsDistanceKm

  const kmSinceLastFull = validManualOdometer != null
    ? validManualOdometer - lastFullRefuel.odometer_km
    : Math.max(latestKnownDistanceKm, gpsDistanceKm)
  const source: CurrentFuelRangeSource = validManualOdometer != null
    ? 'manual_odometer'
    : gpsDistanceKm > latestKnownDistanceKm
      ? 'gps'
      : 'last_refuel'
  const estimatedLitersUsed = Math.max(0, kmSinceLastFull / averageKmPerLiter)
  const estimatedLitersLeft = Math.max(0, Math.min(tankCapacityL, tankCapacityL - estimatedLitersUsed))

  return {
    lastFullRefuel,
    kmSinceLastFull,
    averageKmPerLiter,
    estimatedRangeKm: estimatedLitersLeft * averageKmPerLiter,
    estimatedLitersUsed,
    estimatedLitersLeft,
    currentOdometerKm: validManualOdometer ?? Math.max(latestKnownOdometerKm, gpsCurrentOdometerKm),
    gpsDistanceKm,
    source,
    isEstimate: source === 'gps',
  }
}

/** Costo per km. null se km <= 0. */
export function costPerKm(amountEur: number, kmDriven: number): number | null {
  return kmDriven > 0 ? amountEur / kmDriven : null
}

/** Spesa totale del mese corrente. */
export function currentMonthSpending(refuels: Refuel[], reference = new Date()): number {
  const monthStart = toLocalISODate(firstDayOfMonth(reference))

  return refuels
    .filter(r => r.date >= monthStart)
    .reduce((sum, r) => sum + r.amount_eur, 0)
}
