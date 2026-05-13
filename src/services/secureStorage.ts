import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { decryptLocalPayload, encryptLocalPayload } from './localCrypto'

const SECURE_PREFIX = 'garagemoto:secure:'

export const secureSupabaseStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const secureKey = toSecureKey(key)
    const secureValue = await SecureStore.getItemAsync(secureKey)
    if (secureValue != null) {
      return secureValue
    }

    const legacyValue = await AsyncStorage.getItem(key)
    if (legacyValue != null) {
      await SecureStore.setItemAsync(secureKey, legacyValue)
      await AsyncStorage.removeItem(key)
    }

    return legacyValue
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(toSecureKey(key), value)
    await AsyncStorage.removeItem(key)
  },
  removeItem: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(toSecureKey(key))
    await AsyncStorage.removeItem(key)
  },
}

export async function getSecureString(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(toSecureKey(key))
}

export async function setSecureString(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(toSecureKey(key), value)
}

export async function removeSecureString(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(toSecureKey(key))
}

export async function getProtectedJsonFromAsyncStorage<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key)
  if (!raw) {
    return null
  }

  const decrypted = await decryptLocalPayload(raw)
  if (decrypted !== raw) {
    return JSON.parse(decrypted) as T
  }

  await setProtectedJsonInAsyncStorage(key, JSON.parse(raw) as T)
  return JSON.parse(raw) as T
}

export async function setProtectedJsonInAsyncStorage<T>(key: string, value: T): Promise<void> {
  const serialized = JSON.stringify(value)
  const encrypted = await encryptLocalPayload(serialized)
  await AsyncStorage.setItem(key, encrypted)
}

export async function removeProtectedItemFromAsyncStorage(key: string): Promise<void> {
  await AsyncStorage.removeItem(key)
}

function toSecureKey(key: string): string {
  return `${SECURE_PREFIX}${key}`
}
