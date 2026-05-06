import {
  lastFillConsumption,
  averageConsumption,
  estimatedRange,
  estimatedFuelPct,
  costPerKm,
  currentMonthSpending,
} from '../src/utils/fuelCalculator'
import type { Refuel } from '../src/types/refuel'

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
    const today = new Date().toISOString().split('T')[0]
    const lastYear = `${new Date().getFullYear() - 1}-01-01`
    const refuels = [
      makeRefuel({ date: today, amount_eur: 30 }),
      makeRefuel({ date: today, amount_eur: 25 }),
      makeRefuel({ date: lastYear, amount_eur: 100 }),
    ]
    expect(currentMonthSpending(refuels)).toBe(55)
  })
})
