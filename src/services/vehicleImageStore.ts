import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system/legacy'
import { getSecureString, removeSecureString } from './secureStorage'

const LEGACY_VEHICLE_IMAGES_KEY = 'garagemoto:vehicle-images'
const VEHICLE_IMAGES_DIR = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}vehicle-images/` : null

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
        Object.entries(map).map(([vehicleId, uri]) => AsyncStorage.setItem(buildVehicleImageKey(vehicleId), uri)),
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
  const storedUri = await readStoredVehicleImageUri(vehicleId)
  if (!storedUri) {
    return null
  }

  if (isManagedVehicleImageUri(storedUri)) {
    const info = await FileSystem.getInfoAsync(storedUri)
    if (info.exists) {
      return storedUri
    }

    await removeSecureString(buildVehicleImageKey(vehicleId))
    return null
  }

  try {
    return await persistVehicleImageUri(vehicleId, storedUri)
  } catch (error) {
    console.warn('[vehicleImageStore] migrate legacy picker uri:', error)
    return storedUri
  }
}

export async function setVehicleImageUri(vehicleId: string, uri: string): Promise<string> {
  await migrateLegacyVehicleImages()
  try {
    return await persistVehicleImageUri(vehicleId, uri)
  } catch (error) {
    console.warn('[vehicleImageStore] persist vehicle image fallback:', error)
    await writeStoredVehicleImageUri(vehicleId, uri)
    return uri
  }
}

export async function removeVehicleImageUri(vehicleId: string): Promise<void> {
  await migrateLegacyVehicleImages()
  const currentUri = await readStoredVehicleImageUri(vehicleId)
  await AsyncStorage.removeItem(buildVehicleImageKey(vehicleId))
  await removeSecureString(buildVehicleImageKey(vehicleId)).catch(() => undefined)

  if (currentUri && isManagedVehicleImageUri(currentUri)) {
    await FileSystem.deleteAsync(currentUri, { idempotent: true }).catch((error) => {
      console.warn('[vehicleImageStore] delete vehicle image file:', error)
    })
  }
}

function buildVehicleImageKey(vehicleId: string): string {
  return `garagemoto:vehicle-image:${vehicleId}`
}

async function persistVehicleImageUri(vehicleId: string, sourceUri: string): Promise<string> {
  if (!VEHICLE_IMAGES_DIR) {
    throw new Error('documentDirectory unavailable')
  }

  await FileSystem.makeDirectoryAsync(VEHICLE_IMAGES_DIR, { intermediates: true })

  const targetUri = `${VEHICLE_IMAGES_DIR}${vehicleId}.${inferFileExtension(sourceUri)}`
  const previousUri = await readStoredVehicleImageUri(vehicleId)

  if (sourceUri !== targetUri) {
    await FileSystem.deleteAsync(targetUri, { idempotent: true }).catch(() => undefined)
    await FileSystem.copyAsync({ from: sourceUri, to: targetUri })
  }

  await writeStoredVehicleImageUri(vehicleId, targetUri)

  if (previousUri && previousUri !== targetUri && isManagedVehicleImageUri(previousUri)) {
    await FileSystem.deleteAsync(previousUri, { idempotent: true }).catch((error) => {
      console.warn('[vehicleImageStore] remove previous vehicle image file:', error)
    })
  }

  return targetUri
}

async function readStoredVehicleImageUri(vehicleId: string): Promise<string | null> {
  const storageKey = buildVehicleImageKey(vehicleId)
  const storedUri = await AsyncStorage.getItem(storageKey)
  if (storedUri != null) {
    return storedUri
  }

  try {
    const legacySecureUri = await getSecureString(storageKey)
    if (legacySecureUri != null) {
      await AsyncStorage.setItem(storageKey, legacySecureUri)
      await removeSecureString(storageKey).catch(() => undefined)
      return legacySecureUri
    }
  } catch (error) {
    console.warn('[vehicleImageStore] secure storage fallback read:', error)
  }

  return null
}

async function writeStoredVehicleImageUri(vehicleId: string, uri: string): Promise<void> {
  const storageKey = buildVehicleImageKey(vehicleId)
  await AsyncStorage.setItem(storageKey, uri)
  await removeSecureString(storageKey).catch(() => undefined)
}

function isManagedVehicleImageUri(uri: string): boolean {
  return VEHICLE_IMAGES_DIR != null && uri.startsWith(VEHICLE_IMAGES_DIR)
}

function inferFileExtension(uri: string): string {
  const normalizedUri = uri.split('?')[0] ?? uri
  const match = normalizedUri.match(/\.([a-zA-Z0-9]{2,5})$/)
  const extension = match?.[1]?.toLowerCase()

  if (!extension) {
    return 'jpg'
  }

  return extension === 'jpeg' ? 'jpg' : extension
}
