import AsyncStorage from '@react-native-async-storage/async-storage'

const VEHICLE_IMAGES_KEY = 'garagemoto:vehicle-images'

type VehicleImageMap = Record<string, string>

async function readVehicleImages(): Promise<VehicleImageMap> {
  try {
    const raw = await AsyncStorage.getItem(VEHICLE_IMAGES_KEY)
    if (!raw) {
      return {}
    }

    return JSON.parse(raw) as VehicleImageMap
  } catch (error) {
    console.error('[vehicleImageStore] read:', error)
    return {}
  }
}

async function writeVehicleImages(map: VehicleImageMap): Promise<void> {
  await AsyncStorage.setItem(VEHICLE_IMAGES_KEY, JSON.stringify(map))
}

export async function getVehicleImageUri(vehicleId: string): Promise<string | null> {
  const map = await readVehicleImages()
  return map[vehicleId] ?? null
}

export async function setVehicleImageUri(vehicleId: string, uri: string): Promise<void> {
  const map = await readVehicleImages()
  map[vehicleId] = uri
  await writeVehicleImages(map)
}

export async function removeVehicleImageUri(vehicleId: string): Promise<void> {
  const map = await readVehicleImages()
  delete map[vehicleId]
  await writeVehicleImages(map)
}
