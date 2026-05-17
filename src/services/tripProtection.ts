import type { AppDatabase } from '../db/client'
import type { Trip } from '../types/trip'
import { decryptLocalPayload, encryptLocalPayload, isEncryptedPayload } from './localCrypto'

type TripLocalRow = Pick<Trip, 'id' | 'route_json' | 'notes'>

export async function protectTripForLocalStorage(
  trip: Pick<Trip, 'route_json' | 'notes'>,
): Promise<{ route_json: string; notes: string | null }> {
  try {
    return {
      route_json: await encryptLocalPayload(trip.route_json),
      notes: trip.notes ? await encryptLocalPayload(trip.notes) : null,
    }
  } catch (error) {
    console.warn('[tripProtection] encrypt fallback:', error)
    return {
      route_json: trip.route_json,
      notes: trip.notes ?? null,
    }
  }
}

export async function unprotectTripFromLocalStorage(
  row: Pick<Trip, 'route_json' | 'notes'>,
): Promise<{ route_json: string; notes: string | null }> {
  try {
    return {
      route_json: await decryptLocalPayload(row.route_json),
      notes: row.notes ? await decryptLocalPayload(row.notes) : null,
    }
  } catch (error) {
    console.warn('[tripProtection] decrypt fallback:', error)
    return {
      route_json: row.route_json,
      notes: row.notes ?? null,
    }
  }
}

export function tripNeedsProtectionMigration(row: Pick<Trip, 'route_json' | 'notes'>): boolean {
  return !isEncryptedPayload(row.route_json) || Boolean(row.notes && !isEncryptedPayload(row.notes))
}

export async function migrateTripProtectionRow(
  db: AppDatabase,
  row: TripLocalRow,
): Promise<void> {
  if (!tripNeedsProtectionMigration(row)) {
    return
  }

  const protectedData = await protectTripForLocalStorage(row)
  await db.runAsync(
    'UPDATE trips SET route_json=?, notes=? WHERE id=?',
    [protectedData.route_json, protectedData.notes, row.id],
  )
}
