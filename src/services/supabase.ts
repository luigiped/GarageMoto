import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

function isPlaceholderValue(value: string | undefined): boolean {
  if (!value) return true

  return (
    value.includes('xxxxxxxx') ||
    value.includes('...') ||
    value.includes('your_') ||
    value.includes('example')
  )
}

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !isPlaceholderValue(supabaseUrl) &&
  !isPlaceholderValue(supabaseAnonKey),
)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null

export const SUPABASE_MISSING_CONFIG_MESSAGE =
  'Supabase non configurato: avvio in modalita locale. Inserisci credenziali reali in .env.local per abilitare login e sync.'
