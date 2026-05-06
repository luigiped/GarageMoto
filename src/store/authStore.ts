import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import {
  isSupabaseConfigured,
  SUPABASE_MISSING_CONFIG_MESSAGE,
  supabase,
} from '../services/supabase'

interface AuthStore {
  session: Session | null
  user: User | null
  isLoading: boolean
  error: string | null
  // Actions
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  setSession: (session: Session | null) => void
  clearError: () => void
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
  user: isSupabaseConfigured ? null : LOCAL_TEST_USER,
  isLoading: false,
  error: null,

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? (isSupabaseConfigured ? null : LOCAL_TEST_USER),
    }),

  clearError: () => set({ error: null }),

  signInWithEmail: async (email, password) => {
    if (!isSupabaseConfigured || !supabase) {
      set({ error: SUPABASE_MISSING_CONFIG_MESSAGE })
      return
    }

    set({ isLoading: true, error: null })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      set({ isLoading: false, error: mapError(error.message) })
    } else {
      set({ isLoading: false })
    }
  },

  signUpWithEmail: async (email, password) => {
    if (!isSupabaseConfigured || !supabase) {
      set({ error: SUPABASE_MISSING_CONFIG_MESSAGE })
      return
    }

    set({ isLoading: true, error: null })
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      set({ isLoading: false, error: mapError(error.message) })
    } else {
      set({ isLoading: false })
    }
  },

  signOut: async () => {
    set({ isLoading: true })
    if (supabase) {
      await supabase.auth.signOut()
    }
    set({
      session: null,
      user: isSupabaseConfigured ? null : LOCAL_TEST_USER,
      isLoading: false,
    })
  },
}))
