import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import {
  AUTH_REDIRECT_URL,
  clearSupabaseSession,
  isLocalModeEnabled,
  isSupabaseConfigured,
  SUPABASE_MISSING_CONFIG_MESSAGE,
  supabase,
} from '../services/supabase'

interface AuthStore {
  session: Session | null
  user: User | null
  isLoading: boolean
  error: string | null
  notice: string | null
  // Actions
  signInWithEmail: (email: string, password: string) => Promise<boolean>
  signUpWithEmail: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  setSession: (session: Session | null) => void
  clearError: () => void
  clearNotice: () => void
}

const LOCAL_TEST_USER = {
  id: 'local-test-user',
  email: 'locale@garagemoto.app',
} as User

const ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'Email o password non corretti',
  'Email not confirmed': 'Conferma la tua email prima di accedere',
  'User already registered': 'Questa email è già registrata',
  'Password should be at least 6 characters': 'La password deve essere di almeno 6 caratteri',
}

function mapError(message: string): string {
  return ERROR_MAP[message] ?? 'Si è verificato un errore. Riprova.'
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  user: isLocalModeEnabled ? LOCAL_TEST_USER : null,
  isLoading: false,
  error: null,
  notice: null,

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? (isLocalModeEnabled ? LOCAL_TEST_USER : null),
      error: null,
    }),

  clearError: () => set({ error: null }),
  clearNotice: () => set({ notice: null }),

  signInWithEmail: async (email, password) => {
    if (!isSupabaseConfigured || !supabase) {
      set({ error: SUPABASE_MISSING_CONFIG_MESSAGE, notice: null })
      return false
    }

    set({ isLoading: true, error: null, notice: null })
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      set({ isLoading: false, error: mapError(error.message), notice: null })
      return false
    } else {
      set({
        isLoading: false,
        notice: data.user ? 'Accesso eseguito correttamente.' : null,
      })
      return true
    }
  },

  signUpWithEmail: async (email, password) => {
    if (!isSupabaseConfigured || !supabase) {
      set({ error: SUPABASE_MISSING_CONFIG_MESSAGE, notice: null })
      return false
    }

    set({ isLoading: true, error: null, notice: null })
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: AUTH_REDIRECT_URL,
      },
    })
    if (error) {
      set({ isLoading: false, error: mapError(error.message), notice: null })
      return false
    } else {
      const requiresConfirmation = !data.session
      set({
        isLoading: false,
        notice: requiresConfirmation
          ? 'Registrazione completata. Controlla la tua email, conferma l’account e poi accedi dall’app.'
          : 'Registrazione completata con accesso immediato.',
      })
      return true
    }
  },

  signOut: async () => {
    set({ isLoading: true })
    if (supabase) {
      await clearSupabaseSession()
    }
    set({
      session: null,
      user: isLocalModeEnabled ? LOCAL_TEST_USER : null,
      isLoading: false,
      notice: null,
      error: null,
    })
  },
}))
