import AsyncStorage from '@react-native-async-storage/async-storage'

const PERFORMANCE_CONSENT_KEY = 'garagemoto:performance-consent-v1'

export async function hasAcceptedPerformanceDisclaimer(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PERFORMANCE_CONSENT_KEY)
  return raw === '1'
}

export async function acceptPerformanceDisclaimer(): Promise<void> {
  await AsyncStorage.setItem(PERFORMANCE_CONSENT_KEY, '1')
}

export async function resetPerformanceDisclaimer(): Promise<void> {
  await AsyncStorage.removeItem(PERFORMANCE_CONSENT_KEY)
}
