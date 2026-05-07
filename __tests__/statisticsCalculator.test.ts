// R1.1
import {
  monthlySpending,
  monthlyKm,
  consumptionSeries,
  periodSummary,
  lastNMonths,
  monthLabel,
} from '../src/utils/statisticsCalculator'
import type { Refuel } from '../src/types/refuel'
import type { Trip } from '../src/types/trip'

function makeRefuel(overrides: Partial<Refuel>): Refuel {
  const now = new Date().toISOString()
  return {
    id: 'r1', user_id: 'u1', vehicle_id: 'v1',
    date: '2026-05-01', odometer_km: 10000, liters: 15,
    amount_eur: 25, is_full_tank: true,
    created_at: now, updated_at: now, ...overrides,
  }
}

function makeTrip(overrides: Partial<Trip>): Trip {
  const now = new Date().toISOString()
  return {
    id: 't1', user_id: 'u1', vehicle_id: 'v1',
    start_time: '2026-05-01T10:00:00.000Z',
    end_time: '2026-05-01T11:00:00.000Z',
    distance_km: 50, duration_minutes: 60,
    avg_speed_kmh: 50, max_speed_kmh: 100,
    route_json: '[]', created_at: now, updated_at: now, ...overrides,
  }
}

describe('monthlySpending', () => {
  it('raggruppa correttamente per mese', () => {
    const refuels = [
      makeRefuel({ date: '2026-05-01', amount_eur: 30 }),
      makeRefuel({ date: '2026-05-15', amount_eur: 25 }),
      makeRefuel({ date: '2026-04-10', amount_eur: 20 }),
    ]
    const result = monthlySpending(refuels)
    expect(result['2026-05']).toBeCloseTo(55)
    expect(result['2026-04']).toBeCloseTo(20)
  })

  it('restituisce oggetto vuoto per lista vuota', () => {
    expect(monthlySpending([])).toEqual({})
  })
})

describe('monthlyKm', () => {
  it('raggruppa km per mese correttamente', () => {
    const trips = [
      makeTrip({ start_time: '2026-05-01T10:00:00Z', distance_km: 100 }),
      makeTrip({ start_time: '2026-05-15T10:00:00Z', distance_km: 50 }),
      makeTrip({ start_time: '2026-04-10T10:00:00Z', distance_km: 80 }),
    ]
    const result = monthlyKm(trips)
    expect(result['2026-05']).toBeCloseTo(150)
    expect(result['2026-04']).toBeCloseTo(80)
  })
})

describe('consumptionSeries', () => {
  it('esclude rifornimenti parziali', () => {
    const refuels = [
      makeRefuel({ date: '2026-05-01', is_full_tank: true,  km_per_liter: 18 }),
      makeRefuel({ date: '2026-05-10', is_full_tank: false, km_per_liter: 17 }),
      makeRefuel({ date: '2026-05-20', is_full_tank: true,  km_per_liter: 19 }),
    ]
    const result = consumptionSeries(refuels)
    expect(result).toHaveLength(2)
    expect(result.every(r => r.value > 0)).toBe(true)
  })

  it('restituisce lista vuota se < 2 rifornimenti completi', () => {
    const refuels = [makeRefuel({ is_full_tank: false })]
    expect(consumptionSeries(refuels)).toHaveLength(0)
  })

  it('ordina cronologicamente', () => {
    const refuels = [
      makeRefuel({ date: '2026-05-20', is_full_tank: true, km_per_liter: 19 }),
      makeRefuel({ date: '2026-04-01', is_full_tank: true, km_per_liter: 17 }),
    ]
    const result = consumptionSeries(refuels)
    expect(result[0].date).toBe('2026-04-01')
    expect(result[1].date).toBe('2026-05-20')
  })
})

describe('periodSummary', () => {
  it('filtra correttamente per date', () => {
    const from = new Date('2026-05-01')
    const to   = new Date('2026-05-31')
    const refuels = [
      makeRefuel({ date: '2026-05-10', amount_eur: 30, liters: 15 }),
      makeRefuel({ date: '2026-04-10', amount_eur: 50, liters: 20 }), // fuori range
    ]
    const trips = [
      makeTrip({ start_time: '2026-05-10T10:00:00Z', distance_km: 100 }),
      makeTrip({ start_time: '2026-04-05T10:00:00Z', distance_km: 200 }), // fuori range
    ]
    const result = periodSummary(refuels, trips, from, to)
    expect(result.totalEur).toBeCloseTo(30)
    expect(result.totalLiters).toBeCloseTo(15)
    expect(result.totalKm).toBeCloseTo(100)
    expect(result.tripCount).toBe(1)
  })
})

describe('lastNMonths', () => {
  it('restituisce N mesi in ordine dal più vecchio', () => {
    const months = lastNMonths(3)
    expect(months).toHaveLength(3)
    expect(months[0] < months[1]).toBe(true)
    expect(months[1] < months[2]).toBe(true)
  })
})

describe('monthLabel', () => {
  it('formatta correttamente', () => {
    expect(monthLabel('2026-05')).toBe("mag '26")
    expect(monthLabel('2026-01')).toBe("gen '26")
  })
})
