import {
  getProtectedJsonFromAsyncStorage,
  removeProtectedItemFromAsyncStorage,
  setProtectedJsonInAsyncStorage,
} from './secureStorage'
import type { RoutePoint } from '../types/trip'

const MANUAL_TRIP_DRAFT_KEY = 'garagemoto:manual-trip-draft'

export type ManualTripDraft = {
  userId: string
  vehicleId: string
  startTs: number
  updatedTs: number
  maxSpeedKmh: number
  points: RoutePoint[]
  maxLeanAngleDeg: number | null
  maxLeanLeftDeg: number | null
  maxLeanRightDeg: number | null
}

export async function getManualTripDraft(): Promise<ManualTripDraft | null> {
  return getProtectedJsonFromAsyncStorage<ManualTripDraft>(MANUAL_TRIP_DRAFT_KEY)
}

export async function saveManualTripDraft(draft: ManualTripDraft): Promise<void> {
  await setProtectedJsonInAsyncStorage(MANUAL_TRIP_DRAFT_KEY, draft)
}

export async function clearManualTripDraft(): Promise<void> {
  await removeProtectedItemFromAsyncStorage(MANUAL_TRIP_DRAFT_KEY)
}

export function buildManualTripDraft(input: {
  userId: string
  vehicleId: string
  startTs: number
  maxSpeedKmh: number
  points: RoutePoint[]
  maxLeanAngleDeg: number | null
  maxLeanLeftDeg: number | null
  maxLeanRightDeg: number | null
}): ManualTripDraft {
  return {
    ...input,
    updatedTs: Date.now(),
  }
}
