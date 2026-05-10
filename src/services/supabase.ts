import { createClient, type EmailOtpType } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
const supabaseStorageKey = supabaseUrl ? buildSupabaseStorageKey(supabaseUrl) : null

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

export const isLocalModeEnabled = !isSupabaseConfigured && __DEV__

export const PRODUCTION_CONFIG_ERROR_MESSAGE =
  'Build non valida per la produzione: configurazione Supabase mancante o incompleta.'

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

export const AUTH_REDIRECT_URL = 'garagemoto://login'

export function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const message = 'message' in error && typeof error.message === 'string'
    ? error.message.toLowerCase()
    : ''
  const code = 'code' in error && typeof error.code === 'string'
    ? error.code.toLowerCase()
    : ''

  return (
    code === 'refresh_token_not_found' ||
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found')
  )
}

export async function clearSupabaseSession(): Promise<void> {
  if (!supabaseStorageKey) {
    return
  }

  try {
    await supabase?.auth.signOut({ scope: 'local' })
  } catch (error) {
    console.warn('[supabase] local signOut failed, clearing storage directly:', error)
  }

  await AsyncStorage.multiRemove([
    supabaseStorageKey,
    `${supabaseStorageKey}-user`,
    `${supabaseStorageKey}-code-verifier`,
  ])
}

export async function recoverSupabaseSession(error: unknown): Promise<boolean> {
  if (!isInvalidRefreshTokenError(error)) {
    return false
  }

  await clearSupabaseSession()
  return true
}

type AuthRedirectResult = {
  handled: boolean
  success: boolean
  needsLogin?: boolean
  error?: string
}

export async function handleSupabaseAuthRedirect(url: string): Promise<AuthRedirectResult> {
  if (!supabase) {
    return { handled: false, success: false }
  }

  const params = extractAuthParams(url)
  const tokenHash = readStringParam(params, 'token_hash')
  const type = readStringParam(params, 'type')
  const accessToken = readStringParam(params, 'access_token')
  const refreshToken = readStringParam(params, 'refresh_token')

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    })

    return error
      ? { handled: true, success: false, error: error.message }
      : { handled: true, success: true, needsLogin: !data.session }
  }

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })

    return error
      ? { handled: true, success: false, error: error.message }
      : { handled: true, success: true, needsLogin: !data.session }
  }

  return { handled: false, success: false }
}

function extractAuthParams(url: string): URLSearchParams {
  const [withoutHash, hash = ''] = url.split('#')
  const query = withoutHash.includes('?') ? withoutHash.split('?')[1] : ''
  const params = new URLSearchParams(query)
  const hashParams = new URLSearchParams(hash)

  hashParams.forEach((value, key) => {
    if (!params.has(key)) {
      params.set(key, value)
    }
  })

  return params
}

function readStringParam(params: URLSearchParams, key: string): string | null {
  const value = params.get(key)
  return value && value.trim() ? value : null
}

function buildSupabaseStorageKey(url: string): string {
  try {
    const hostPrefix = new URL(url).hostname.split('.')[0]
    return `sb-${hostPrefix}-auth-token`
  } catch {
    return 'supabase-auth'
  }
}
