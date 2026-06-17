import {
  lastFillConsumption,
  averageConsumption,
  estimatedRange,
  estimatedFuelPct,
  currentFuelRange,
  costPerKm,
  currentMonthSpending,
} from '../src/utils/fuelCalculator'
import type { Refuel } from '../src/types/refuel'
import type { Trip } from '../src/types/trip'

function makeRefuel(overrides: Partial<Refuel>): Refuel {
  const now = new Date().toISOString()
  return {
    id: 'test',
    user_id: 'u1',
    vehicle_id: 'v1',
    date: new Date().toISOString().split('T')[0],
    odometer_km: 10000,
    liters: 15,
    amount_eur: 25,
    is_full_tank: true,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function makeTrip(overrides: Partial<Trip>): Trip {
  const now = new Date().toISOString()
  return {
    id: 'trip',
    user_id: 'u1',
    vehicle_id: 'v1',
    start_time: '2026-06-02T09:00:00.000Z',
    end_time: '2026-06-02T10:00:00.000Z',
    distance_km: 50,
    duration_minutes: 60,
    avg_speed_kmh: 50,
    max_speed_kmh: 90,
    route_json: '[]',
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

describe('lastFillConsumption', () => {
  it('calcola km/l correttamente', () => {
    expect(lastFillConsumption(10300, 10000, 15, true)).toBeCloseTo(20)
  })
  it('restituisce null se non è pieno', () => {
    expect(lastFillConsumption(10300, 10000, 15, false)).toBeNull()
  })
  it('restituisce null se km <= 0', () => {
    expect(lastFillConsumption(10000, 10000, 15, true)).toBeNull()
  })
  it('restituisce null se litri <= 0', () => {
    expect(lastFillConsumption(10300, 10000, 0, true)).toBeNull()
  })
})

describe('averageConsumption', () => {
  it('calcola media ponderata corretta', () => {
    const refuels = [
      makeRefuel({ odometer_km: 10300, liters: 15, is_full_tank: true }),
      makeRefuel({ odometer_km: 10000, liters: 15, is_full_tank: true }),
    ]
    expect(averageConsumption(refuels)).toBeCloseTo(20)
  })
  it('restituisce null con un solo pieno', () => {
    expect(averageConsumption([makeRefuel({ is_full_tank: true })])).toBeNull()
  })
  it('ignora i rifornimenti parziali', () => {
    const refuels = [
      makeRefuel({ odometer_km: 10300, liters: 15, is_full_tank: true }),
      makeRefuel({ odometer_km: 10150, liters: 8, is_full_tank: false }),
      makeRefuel({ odometer_km: 10000, liters: 15, is_full_tank: true }),
    ]
    expect(averageConsumption(refuels)).toBeCloseTo(20)
  })
  it('restituisce null con lista vuota', () => {
    expect(averageConsumption([])).toBeNull()
  })
})

describe('estimatedRange', () => {
  it('calcola autonomia corretta', () => {
    const refuels = [
      makeRefuel({ odometer_km: 10300, liters: 15, is_full_tank: true }),
      makeRefuel({ odometer_km: 10000, liters: 15, is_full_tank: true }),
    ]
    // Appena rifornito → serbatoio pieno (15L) * 20 km/l = 300km
    const result = estimatedRange(15, refuels, 10300)
    expect(result).toBeCloseTo(300)
  })
  it('restituisce null con lista vuota', () => {
    expect(estimatedRange(15, [], 10000)).toBeNull()
  })
})

describe('estimatedFuelPct', () => {
  it('clampato a 1 se autonomia alta', () => {
    expect(estimatedFuelPct(15, 9999, 20)).toBe(1)
  })
  it('restituisce 0 se consumo medio <= 0', () => {
    expect(estimatedFuelPct(15, 100, 0)).toBe(0)
  })
  it('calcola 50% correttamente', () => {
    // 7.5L / 15L = 50% → autonomia = 7.5 * 20 = 150km
    expect(estimatedFuelPct(15, 150, 20)).toBeCloseTo(0.5)
  })
})

describe('currentFuelRange', () => {
  const refuels = [
    makeRefuel({ date: '2026-06-01', odometer_km: 10300, liters: 15, is_full_tank: true }),
    makeRefuel({ date: '2026-05-01', odometer_km: 10000, liters: 15, is_full_tank: true }),
  ]

  it("usa l'odometro manuale prima dei trip GPS", () => {
    const result = currentFuelRange(15, refuels, [makeTrip({ distance_km: 80 })], 10420)

    expect(result.source).toBe('manual_odometer')
    expect(result.isEstimate).toBe(false)
    expect(result.kmSinceLastFull).toBe(120)
    expect(result.estimatedRangeKm).toBeCloseTo(180)
  })

  it("usa la somma dei trip GPS dopo l'ultimo pieno se manca l'odometro manuale", () => {
    const result = currentFuelRange(15, refuels, [
      makeTrip({ start_time: '2026-06-02T09:00:00.000Z', distance_km: 80 }),
      makeTrip({ start_time: '2026-05-31T09:00:00.000Z', distance_km: 30 }),
    ])

    expect(result.source).toBe('gps')
    expect(result.isEstimate).toBe(true)
    expect(result.kmSinceLastFull).toBe(80)
    expect(result.estimatedRangeKm).toBeCloseTo(220)
  })

  it("usa l'ultimo odometro noto se e piu avanti dei trip GPS", () => {
    const result = currentFuelRange(15, [
      makeRefuel({ date: '2026-06-10', odometer_km: 10450, liters: 7, is_full_tank: false }),
      ...refuels,
    ], [makeTrip({ start_time: '2026-06-02T09:00:00.000Z', distance_km: 80 })])

    expect(result.source).toBe('last_refuel')
    expect(result.isEstimate).toBe(false)
    expect(result.kmSinceLastFull).toBe(150)
    expect(result.currentOdometerKm).toBe(10450)
    expect(result.estimatedRangeKm).toBeCloseTo(150)
  })

  it("ignora l'odometro manuale se e inferiore all'ultimo odometro noto", () => {
    const result = currentFuelRange(15, [
      makeRefuel({ date: '2026-06-10', odometer_km: 10450, liters: 7, is_full_tank: false }),
      ...refuels,
    ], [], 10400)

    expect(result.source).toBe('last_refuel')
    expect(result.kmSinceLastFull).toBe(150)
    expect(result.currentOdometerKm).toBe(10450)
  })

  it('restituisce valori null se non ci sono abbastanza pieni completi', () => {
    const result = currentFuelRange(15, [refuels[0]], [], null)

    expect(result.source).toBe('none')
    expect(result.kmSinceLastFull).toBeNull()
    expect(result.estimatedRangeKm).toBeNull()
  })
})

describe('costPerKm', () => {
  it('calcola costo/km correttamente', () => {
    expect(costPerKm(30, 300)).toBeCloseTo(0.1)
  })
  it('restituisce null se km <= 0', () => {
    expect(costPerKm(30, 0)).toBeNull()
  })
})

describe('currentMonthSpending', () => {
  it('somma solo rifornimenti del mese corrente', () => {
    const refuels = [
      makeRefuel({ date: '2026-06-01', amount_eur: 30 }),
      makeRefuel({ date: '2026-06-08', amount_eur: 25 }),
      makeRefuel({ date: '2026-05-31', amount_eur: 100 }),
    ]
    expect(currentMonthSpending(refuels, new Date(2026, 5, 8))).toBe(55)
  })
})
