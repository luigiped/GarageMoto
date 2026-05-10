import { computeMaxBrakingG } from '../src/utils/tripMetrics'
import type { RoutePoint } from '../src/types/trip'

describe('computeMaxBrakingG', () => {
  it('returns null with fewer than two points', () => {
    const points: RoutePoint[] = [{ lat: 0, lng: 0, ts: 0, speedKmh: 30 }]
    expect(computeMaxBrakingG(points)).toBeNull()
  })

  it('returns strongest braking sample in g', () => {
    const points: RoutePoint[] = [
      { lat: 0, lng: 0, ts: 0, speedKmh: 72 },
      { lat: 0, lng: 0, ts: 2000, speedKmh: 36 },
      { lat: 0, lng: 0, ts: 4000, speedKmh: 18 },
    ]

    expect(computeMaxBrakingG(points)).toBe(0.51)
  })

  it('ignores acceleration and invalid timestamps', () => {
    const points: RoutePoint[] = [
      { lat: 0, lng: 0, ts: 0, speedKmh: 20 },
      { lat: 0, lng: 0, ts: 0, speedKmh: 5 },
      { lat: 0, lng: 0, ts: 3000, speedKmh: 25 },
    ]

    expect(computeMaxBrakingG(points)).toBeNull()
  })
})
