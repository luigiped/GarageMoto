import type { RoutePoint } from '../types/trip'

const STANDARD_GRAVITY = 9.80665
const MIN_BRAKING_SAMPLE_SECONDS = 1

export function computeMaxBrakingG(points: RoutePoint[]): number | null {
  if (points.length < 2) {
    return null
  }

  let maxBrakingG = 0

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const deltaSeconds = (current.ts - previous.ts) / 1000

    if (!Number.isFinite(deltaSeconds) || deltaSeconds < MIN_BRAKING_SAMPLE_SECONDS) {
      continue
    }

    const previousSpeedMs = Math.max(0, previous.speedKmh) / 3.6
    const currentSpeedMs = Math.max(0, current.speedKmh) / 3.6
    const deltaSpeedMs = previousSpeedMs - currentSpeedMs

    if (deltaSpeedMs <= 0) {
      continue
    }

    const brakingG = deltaSpeedMs / deltaSeconds / STANDARD_GRAVITY
    if (Number.isFinite(brakingG)) {
      maxBrakingG = Math.max(maxBrakingG, brakingG)
    }
  }

  if (maxBrakingG <= 0) {
    return null
  }

  return Math.round(maxBrakingG * 100) / 100
}
