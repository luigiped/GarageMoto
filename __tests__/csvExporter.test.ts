import { exportRefuels, exportTrips } from '../src/utils/csvExporter'
import type { Refuel } from '../src/types/refuel'
import type { Trip } from '../src/types/trip'

function makeRefuel(overrides: Partial<Refuel> = {}): Refuel {
  const now = new Date().toISOString()
  return {
    id: 'r1',
    user_id: 'u1',
    vehicle_id: 'v1',
    date: '2026-05-01',
    odometer_km: 10000,
    liters: 12.5,
    amount_eur: 24.5,
    is_full_tank: true,
    notes: 'Nota',
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  const now = new Date().toISOString()
  return {
    id: 't1',
    user_id: 'u1',
    vehicle_id: 'v1',
    start_time: '2026-05-01T10:00:00.000Z',
    end_time: '2026-05-01T11:00:00.000Z',
    distance_km: 84.2,
    duration_minutes: 60,
    avg_speed_kmh: 61.4,
    max_speed_kmh: 109.8,
    route_json: '[]',
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

describe('csvExporter', () => {
  it('genera header corretto per i rifornimenti', () => {
    const csv = exportRefuels([makeRefuel()])
    expect(csv.split('\n')[0]).toBe('Data,Odometro(km),Litri,Importo(€),Prezzo/L,km/L,Pieno,Note')
  })

  it('escapa correttamente le virgolette nelle note', () => {
    const csv = exportRefuels([makeRefuel({ notes: 'Pompa "self", area nord' })])
    expect(csv).toContain('"Pompa ""self"", area nord"')
  })

  it('lascia vuoto il campo note se null', () => {
    const csv = exportRefuels([makeRefuel({ notes: undefined })])
    const row = csv.split('\n')[1]
    expect(row.endsWith(',')).toBe(true)
  })

  it('genera header corretto per i viaggi', () => {
    const csv = exportTrips([makeTrip()])
    expect(csv.split('\n')[0]).toBe('Data inizio,Data fine,Distanza(km),Durata(min),Vel.media(km/h),Vel.max(km/h)')
  })
})
