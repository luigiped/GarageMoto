import { getStatus, kmUntilDue, daysUntilDue } from '../src/utils/maintenanceChecker'
import type { Maintenance } from '../src/types/maintenance'

function makeItem(overrides: Partial<Maintenance>): Maintenance {
  const now = new Date().toISOString()
  return {
    id: 'test',
    user_id: 'u1',
    vehicle_id: 'v1',
    type: 'oil_change',
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

const TODAY = new Date('2026-05-01')

describe('getStatus - km', () => {
  it('ok se lontano dalla scadenza', () => {
    const item = makeItem({ last_km: 10000, interval_km: 5000 })
    expect(getStatus(item, 11000, TODAY)).toBe('ok')
  })
  it('warning se entro 500km', () => {
    const item = makeItem({ last_km: 10000, interval_km: 5000 })
    expect(getStatus(item, 14600, TODAY)).toBe('warning')
  })
  it('overdue se km superati', () => {
    const item = makeItem({ last_km: 10000, interval_km: 5000 })
    expect(getStatus(item, 15100, TODAY)).toBe('overdue')
  })
})

describe('getStatus - data', () => {
  it('ok se data lontana', () => {
    const item = makeItem({ last_date: '2026-01-01', interval_months: 12 })
    expect(getStatus(item, 0, TODAY)).toBe('ok')
  })
  it('warning se entro 30 giorni', () => {
    const item = makeItem({ last_date: '2025-05-15', interval_months: 12 })
    expect(getStatus(item, 0, TODAY)).toBe('warning')
  })
  it('overdue se data superata', () => {
    const item = makeItem({ last_date: '2024-01-01', interval_months: 12 })
    expect(getStatus(item, 0, TODAY)).toBe('overdue')
  })
})

describe('getStatus - senza dati', () => {
  it('ok se nessun dato km o data', () => {
    const item = makeItem({})
    expect(getStatus(item, 10000, TODAY)).toBe('ok')
  })
  it('overdue km prevale su ok data', () => {
    const item = makeItem({
      last_km: 10000, interval_km: 5000,
      last_date: '2026-01-01', interval_months: 12,
    })
    expect(getStatus(item, 16000, TODAY)).toBe('overdue')
  })
})

describe('kmUntilDue', () => {
  it('restituisce km rimanenti', () => {
    const item = makeItem({ last_km: 10000, interval_km: 5000 })
    expect(kmUntilDue(item, 12000)).toBe(3000)
  })
  it('negativo se scaduto', () => {
    const item = makeItem({ last_km: 10000, interval_km: 5000 })
    expect(kmUntilDue(item, 15500)).toBe(-500)
  })
  it('null se mancano dati', () => {
    expect(kmUntilDue(makeItem({}), 10000)).toBeNull()
  })
})

describe('daysUntilDue', () => {
  it('restituisce giorni rimanenti', () => {
    const item = makeItem({ last_date: '2025-05-01', interval_months: 12 })
    expect(daysUntilDue(item, TODAY)).toBe(0) // scade esattamente oggi
  })
  it('null se mancano dati', () => {
    expect(daysUntilDue(makeItem({}, ), TODAY)).toBeNull()
  })
})
