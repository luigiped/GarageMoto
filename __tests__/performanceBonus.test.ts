import type { Refuel } from '../src/types/refuel'
import type { Trip } from '../src/types/trip'
import { buildPerformanceSummary } from '../src/utils/performanceBonus'

function makeRefuel(overrides: Partial<Refuel>): Refuel {
  const now = new Date().toISOString()
  return {
    id: 'r1',
    user_id: 'u1',
    vehicle_id: 'v1',
    date: '2026-05-01',
    odometer_km: 10000,
    liters: 15,
    amount_eur: 25,
    is_full_tank: true,
    km_per_liter: 18,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function makeTrip(overrides: Partial<Trip>): Trip {
  const now = new Date().toISOString()
  return {
    id: 't1',
    user_id: 'u1',
    vehicle_id: 'v1',
    start_time: '2026-05-01T10:00:00.000Z',
    end_time: '2026-05-01T11:00:00.000Z',
    distance_km: 80,
    duration_minutes: 60,
    avg_speed_kmh: 70,
    max_speed_kmh: 110,
    route_json: '[]',
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

describe('buildPerformanceSummary', () => {
  it('calcola i migliori indicatori e genera insight', () => {
    const refuels = [
      makeRefuel({ date: '2026-01-10', km_per_liter: 16, amount_eur: 27, liters: 15 }),
      makeRefuel({ date: '2026-02-10', km_per_liter: 17, amount_eur: 28, liters: 15 }),
      makeRefuel({ date: '2026-03-10', km_per_liter: 18, amount_eur: 29, liters: 15 }),
      makeRefuel({ date: '2026-04-10', km_per_liter: 19, amount_eur: 31, liters: 15 }),
      makeRefuel({ date: '2026-05-10', km_per_liter: 20, amount_eur: 30, liters: 16 }),
      makeRefuel({ date: '2026-06-10', km_per_liter: 21, amount_eur: 29, liters: 16 }),
    ]
    const trips = [
      makeTrip({ distance_km: 120, max_speed_kmh: 140 }),
      makeTrip({ distance_km: 80, max_speed_kmh: 100 }),
    ]

    const summary = buildPerformanceSummary(refuels, trips)
    expect(summary.bestKmL).toBe(21)
    expect(summary.bestTripKm).toBe(120)
    expect(summary.lowestPricePerLiter).toBeCloseTo(1.8)
    expect(summary.insights.length).toBeGreaterThan(0)
  })

  it('restituisce null quando i dati non bastano', () => {
    const summary = buildPerformanceSummary([], [])
    expect(summary.bestKmL).toBeNull()
    expect(summary.bestTripKm).toBeNull()
    expect(summary.lowestPricePerLiter).toBeNull()
    expect(summary.recentEfficiencyDeltaPct).toBeNull()
  })
})
