import AsyncStorage from '@react-native-async-storage/async-storage'
import { getSecureString, removeSecureString, setSecureString } from './secureStorage'

const LEGACY_VEHICLE_IMAGES_KEY = 'garagemoto:vehicle-images'

type VehicleImageMap = Record<string, string>

let legacyMigrationPromise: Promise<void> | null = null

async function migrateLegacyVehicleImages(): Promise<void> {
  if (!legacyMigrationPromise) {
    legacyMigrationPromise = (async () => {
      const raw = await AsyncStorage.getItem(LEGACY_VEHICLE_IMAGES_KEY)
      if (!raw) {
        return
      }

      const map = JSON.parse(raw) as VehicleImageMap
      await Promise.all(
        Object.entries(map).map(([vehicleId, uri]) => setSecureString(buildVehicleImageKey(vehicleId), uri)),
      )
      await AsyncStorage.removeItem(LEGACY_VEHICLE_IMAGES_KEY)
    })().catch((error) => {
      legacyMigrationPromise = null
      throw error
    })
  }

  return legacyMigrationPromise
}

export async function getVehicleImageUri(vehicleId: string): Promise<string | null> {
  await migrateLegacyVehicleImages()
  return getSecureString(buildVehicleImageKey(vehicleId))
}

export async function setVehicleImageUri(vehicleId: string, uri: string): Promise<void> {
  await migrateLegacyVehicleImages()
  await setSecureString(buildVehicleImageKey(vehicleId), uri)
}

export async function removeVehicleImageUri(vehicleId: string): Promise<void> {
  await migrateLegacyVehicleImages()
  await removeSecureString(buildVehicleImageKey(vehicleId))
}

function buildVehicleImageKey(vehicleId: string): string {
  return `garagemoto:vehicle-image:${vehicleId}`
}
