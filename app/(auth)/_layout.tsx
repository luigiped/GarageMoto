import { Redirect, Stack } from 'expo-router'
import { useAuthStore } from '../../src/store/authStore'
import { isSupabaseConfigured } from '../../src/services/supabase'

export default function AuthLayout() {
  const { session, isPasswordRecovery } = useAuthStore()

  if (!isSupabaseConfigured) {
    return <Redirect href="/(tabs)" />
  }

  if (session && !isPasswordRecovery) {
    return <Redirect href="/(tabs)" />
  }

  return <Stack screenOptions={{ headerShown: false }} />
}
