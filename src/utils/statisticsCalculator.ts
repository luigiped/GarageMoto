// R1.1
import type { Refuel } from '../types/refuel'
import type { Trip } from '../types/trip'
import { averageConsumption } from './fuelCalculator'

/** Raggruppa spesa per mese → { '2026-05': 127.50 } */
export function monthlySpending(refuels: Refuel[]): Record<string, number> {
  return refuels.reduce<Record<string, number>>((acc, r) => {
    const key = r.date.slice(0, 7) // YYYY-MM
    acc[key] = (acc[key] ?? 0) + r.amount_eur
    return acc
  }, {})
}

/** Raggruppa km percorsi per mese da trips → { '2026-05': 342 } */
export function monthlyKm(trips: Trip[]): Record<string, number> {
  return trips.reduce<Record<string, number>>((acc, t) => {
    const key = t.start_time.slice(0, 7)
    acc[key] = (acc[key] ?? 0) + t.distance_km
    return acc
  }, {})
}

/** Serie temporale km/l — solo pieni completi, ordine cronologico */
export function consumptionSeries(
  refuels: Refuel[],
): { date: string; value: number }[] {
  const full = refuels
    .filter(r => r.is_full_tank && r.km_per_liter != null)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (full.length < 2) {
    return []
  }

  return full.map(r => ({ date: r.date, value: r.km_per_liter! }))
}

/** Serie temporale prezzo carburante €/L */
export function priceSeries(
  refuels: Refuel[],
): { date: string; value: number }[] {
  return refuels
    .filter(r => r.liters > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => ({ date: r.date, value: r.amount_eur / r.liters }))
}

/** Riepilogo per un periodo dato */
export function periodSummary(
  refuels: Refuel[],
  trips: Trip[],
  from: Date,
  to: Date,
): {
  totalEur: number
  totalLiters: number
  totalKm: number
  avgKmL: number | null
  tripCount: number
} {
  const fromStr = from.toISOString().split('T')[0]
  const toStr   = to.toISOString().split('T')[0]

  const filteredR = refuels.filter(r => r.date >= fromStr && r.date <= toStr)
  const filteredT = trips.filter(t => t.start_time.slice(0, 10) >= fromStr &&
    t.start_time.slice(0, 10) <= toStr)

  const totalEur = filteredR.reduce((s, r) => s + r.amount_eur, 0)
  const totalLiters = filteredR.reduce((s, r) => s + r.liters, 0)
  const totalKm = filteredT.reduce((s, t) => s + t.distance_km, 0)
  const avgKmL = averageConsumption(filteredR)
  const tripCount = filteredT.length

  return { totalEur, totalLiters, totalKm, avgKmL, tripCount }
}

/** Ultimi N mesi come array di chiavi YYYY-MM, dal più vecchio al più recente */
export function lastNMonths(n: number): string[] {
  const result: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return result
}

/** Etichetta breve per un mese YYYY-MM → "mag '26" */
export function monthLabel(key: string): string {
  const months = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']
  const [year, month] = key.split('-').map(Number)
  return `${months[month - 1]} '${String(year).slice(2)}`
}
