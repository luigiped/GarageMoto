import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { decryptLocalPayload, encryptLocalPayload } from './localCrypto'

const SECURE_PREFIX = 'garagemoto:secure:'

export const secureSupabaseStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const secureKey = toSecureKey(key)
    try {
      const secureValue = await SecureStore.getItemAsync(secureKey)
      if (secureValue != null) {
        return secureValue
      }
    } catch (error) {
      console.warn('[secureStorage] getItem secure fallback:', error)
      await SecureStore.deleteItemAsync(secureKey).catch(() => undefined)
    }

    const legacyValue = await AsyncStorage.getItem(key)
    if (legacyValue != null) {
      try {
        await SecureStore.setItemAsync(secureKey, legacyValue)
        await AsyncStorage.removeItem(key)
      } catch (error) {
        console.warn('[secureStorage] migrate legacy auth storage skipped:', error)
      }
    }

    return legacyValue
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(toSecureKey(key), value)
      await AsyncStorage.removeItem(key)
    } catch (error) {
      console.warn('[secureStorage] setItem async fallback:', error)
      await AsyncStorage.setItem(key, value)
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(toSecureKey(key))
    } catch (error) {
      console.warn('[secureStorage] removeItem secure fallback:', error)
    }
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

  try {
    const decrypted = await decryptLocalPayload(raw)
    if (decrypted !== raw) {
      return JSON.parse(decrypted) as T
    }

    await setProtectedJsonInAsyncStorage(key, JSON.parse(raw) as T)
    return JSON.parse(raw) as T
  } catch (error) {
    console.warn('[secureStorage] getProtectedJson fallback:', error)
    return JSON.parse(raw) as T
  }
}

export async function setProtectedJsonInAsyncStorage<T>(key: string, value: T): Promise<void> {
  const serialized = JSON.stringify(value)
  try {
    const encrypted = await encryptLocalPayload(serialized)
    await AsyncStorage.setItem(key, encrypted)
  } catch (error) {
    console.warn('[secureStorage] setProtectedJson fallback:', error)
    await AsyncStorage.setItem(key, serialized)
  }
}

export async function removeProtectedItemFromAsyncStorage(key: string): Promise<void> {
  await AsyncStorage.removeItem(key)
}

function toSecureKey(key: string): string {
  return `${SECURE_PREFIX}${key}`
}
