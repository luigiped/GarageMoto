import { Redirect } from 'expo-router'
import { useAuthStore } from '../src/store/authStore'
import { isSupabaseConfigured } from '../src/services/supabase'

export default function IndexRoute() {
  const { session } = useAuthStore()

  if (!isSupabaseConfigured) {
    return <Redirect href="/(tabs)" />
  }

  return <Redirect href={session ? '/(tabs)' : '/(auth)/login'} />
}
