import { Redirect } from 'expo-router'
import { useAuthStore } from '../src/store/authStore'
import { isSupabaseConfigured } from '../src/services/supabase'

export default function IndexRoute() {
  const { session, isPasswordRecovery } = useAuthStore()

  if (!isSupabaseConfigured) {
    return <Redirect href="/(tabs)" />
  }

  if (session && isPasswordRecovery) {
    return <Redirect href="/reset-password" />
  }

  return <Redirect href={session ? '/(tabs)' : '/login'} />
}
