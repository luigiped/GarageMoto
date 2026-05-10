import type { Refuel } from '../types/refuel'
import type { Trip } from '../types/trip'

export const PERFORMANCE_DISCLAIMER =
  `DATI INDICATIVI — NON PROFESSIONALI

I valori mostrati sono stime calcolate tramite i sensori dello smartphone
(accelerometro, giroscopio) e possono differire significativamente dai
valori reali del veicolo. Non utilizzare questi dati per valutazioni
tecniche, legali o confronti con dati ufficiali del costruttore.

GarageMoto declina ogni responsabilità per l'uso di questi dati.`

export interface PerformanceSummary {
  bestKmL: number | null
  bestTripKm: number | null
  lowestPricePerLiter: number | null
  recentEfficiencyDeltaPct: number | null
  recentMonthlySpendDeltaPct: number | null
  insights: string[]
}

export function buildPerformanceSummary(
  refuels: Refuel[],
  trips: Trip[],
): PerformanceSummary {
  const fullRefuels = refuels
    .filter((refuel) => refuel.is_full_tank && refuel.km_per_liter != null)
    .sort((a, b) => a.date.localeCompare(b.date))

  const bestKmL = fullRefuels.length
    ? Math.max(...fullRefuels.map((refuel) => refuel.km_per_liter!))
    : null

  const bestTripKm = trips.length
    ? Math.max(...trips.map((trip) => trip.distance_km))
    : null

  const priceSeries = refuels
    .filter((refuel) => refuel.liters > 0)
    .map((refuel) => refuel.amount_eur / refuel.liters)
  const lowestPricePerLiter = priceSeries.length ? Math.min(...priceSeries) : null

  const recentEfficiencyDeltaPct = compareRecentEfficiency(fullRefuels)
  const recentMonthlySpendDeltaPct = compareMonthlySpend(refuels)

  const insights = buildInsights({
    bestKmL,
    bestTripKm,
    lowestPricePerLiter,
    recentEfficiencyDeltaPct,
    recentMonthlySpendDeltaPct,
    trips,
  })

  return {
    bestKmL,
    bestTripKm,
    lowestPricePerLiter,
    recentEfficiencyDeltaPct,
    recentMonthlySpendDeltaPct,
    insights,
  }
}

function compareRecentEfficiency(refuels: Refuel[]): number | null {
  if (refuels.length < 6) {
    return null
  }

  const recent = refuels.slice(-3)
  const previous = refuels.slice(-6, -3)
  const recentAvg = average(recent.map((refuel) => refuel.km_per_liter!))
  const previousAvg = average(previous.map((refuel) => refuel.km_per_liter!))

  if (previousAvg <= 0) {
    return null
  }

  return ((recentAvg - previousAvg) / previousAvg) * 100
}

function compareMonthlySpend(refuels: Refuel[]): number | null {
  const monthlyTotals = refuels.reduce<Record<string, number>>((accumulator, refuel) => {
    const key = refuel.date.slice(0, 7)
    accumulator[key] = (accumulator[key] ?? 0) + refuel.amount_eur
    return accumulator
  }, {})

  const months = Object.keys(monthlyTotals).sort()
  if (months.length < 2) {
    return null
  }

  const current = monthlyTotals[months[months.length - 1]]
  const previous = monthlyTotals[months[months.length - 2]]
  if (previous <= 0) {
    return null
  }

  return ((current - previous) / previous) * 100
}

function buildInsights({
  bestKmL,
  bestTripKm,
  lowestPricePerLiter,
  recentEfficiencyDeltaPct,
  recentMonthlySpendDeltaPct,
  trips,
}: {
  bestKmL: number | null
  bestTripKm: number | null
  lowestPricePerLiter: number | null
  recentEfficiencyDeltaPct: number | null
  recentMonthlySpendDeltaPct: number | null
  trips: Trip[]
}): string[] {
  const insights: string[] = []

  if (recentEfficiencyDeltaPct != null) {
    if (recentEfficiencyDeltaPct >= 5) {
      insights.push('Consumi recenti in miglioramento: lo stile di guida sembra piu efficiente.')
    } else if (recentEfficiencyDeltaPct <= -5) {
      insights.push('Consumi recenti in calo: verifica pressione gomme, carico e stile di guida.')
    }
  }

  if (recentMonthlySpendDeltaPct != null) {
    if (recentMonthlySpendDeltaPct >= 10) {
      insights.push('La spesa carburante del mese e in aumento rispetto al mese precedente.')
    } else if (recentMonthlySpendDeltaPct <= -10) {
      insights.push('La spesa carburante del mese e scesa rispetto al mese precedente.')
    }
  }

  if (bestKmL != null) {
    insights.push(`Miglior consumo registrato: ${bestKmL.toFixed(1)} km/l.`)
  }

  if (lowestPricePerLiter != null) {
    insights.push(`Prezzo carburante piu conveniente rilevato: ${lowestPricePerLiter.toFixed(3)} €/L.`)
  }

  if (bestTripKm != null) {
    insights.push(`Viaggio piu lungo registrato: ${bestTripKm.toFixed(1)} km.`)
  }

  const highSpeedTrips = trips.filter((trip) => trip.max_speed_kmh >= 130)
  if (highSpeedTrips.length > 0) {
    insights.push('Sono presenti viaggi con velocita massime elevate: interpreta questi dati solo come riferimento storico.')
  }

  return insights.slice(0, 5)
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}
