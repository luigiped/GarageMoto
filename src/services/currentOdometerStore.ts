import AsyncStorage from '@react-native-async-storage/async-storage'

const CURRENT_ODOMETER_KEY_PREFIX = 'garagemoto:current-odometer-km:'

export interface SavedCurrentOdometer {
  vehicleId: string
  odometerKm: number
  updatedAt: string
}

function getCurrentOdometerKey(vehicleId: string): string {
  return `${CURRENT_ODOMETER_KEY_PREFIX}${vehicleId}`
}

export async function getCurrentOdometerKm(vehicleId: string): Promise<SavedCurrentOdometer | null> {
  const raw = await AsyncStorage.getItem(getCurrentOdometerKey(vehicleId))
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as SavedCurrentOdometer
    if (
      parsed.vehicleId === vehicleId &&
      typeof parsed.odometerKm === 'number' &&
      Number.isFinite(parsed.odometerKm)
    ) {
      return parsed
    }
  } catch {
    return null
  }

  return null
}

export async function saveCurrentOdometerKm(vehicleId: string, odometerKm: number): Promise<void> {
  const payload: SavedCurrentOdometer = {
    vehicleId,
    odometerKm,
    updatedAt: new Date().toISOString(),
  }
  await AsyncStorage.setItem(getCurrentOdometerKey(vehicleId), JSON.stringify(payload))
}
