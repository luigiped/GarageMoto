import type { Refuel } from '../types/refuel'

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

/** Costo per km. null se km <= 0. */
export function costPerKm(amountEur: number, kmDriven: number): number | null {
  return kmDriven > 0 ? amountEur / kmDriven : null
}

/** Spesa totale del mese corrente. */
export function currentMonthSpending(refuels: Refuel[]): number {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0]

  return refuels
    .filter(r => r.date >= monthStart)
    .reduce((sum, r) => sum + r.amount_eur, 0)
}
