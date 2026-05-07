import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useAuthStore } from '../src/store/authStore'
import { initDb } from '../src/db/client'
import {
  isSupabaseConfigured,
  SUPABASE_MISSING_CONFIG_MESSAGE,
  supabase,
} from '../src/services/supabase'
import { colors, font, spacing } from '../src/theme'
import '../src/services/autoTrip'

export default function RootLayout() {
  const { setSession } = useAuthStore()
  const [isReady, setIsReady] = useState(false)
  const [startupError, setStartupError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    let unsubscribe: (() => void) | undefined

    async function bootstrap() {
      try {
        await initDb()
      } catch (error) {
        console.error('[root] initDb:', error)
        if (isMounted) {
          setStartupError('Impossibile inizializzare il database locale.')
        }
        return
      }

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          console.error('[root] getSession:', error)
        }

        if (!isMounted) {
          return
        }

        setSession(data.session)

        const subscription = supabase.auth.onAuthStateChange((_event, session) => {
          setSession(session)
        })
        unsubscribe = () => subscription.data.subscription.unsubscribe()
      } else if (isMounted) {
        setSession(null)
      }

      if (isMounted) {
        setIsReady(true)
      }
    }

    bootstrap()

    return () => {
      isMounted = false
      unsubscribe?.()
    }
  }, [])

  if (startupError) {
    return (
      <View style={styles.center}>
        <StatusBar style="light" />
        <Text style={styles.title}>Avvio non riuscito</Text>
        <Text style={styles.message}>{startupError}</Text>
      </View>
    )
  }

  if (!isReady) {
    return (
      <View style={styles.center}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.title}>GarageMoto</Text>
        <Text style={styles.message}>
          {isSupabaseConfigured
            ? 'Inizializzazione in corso...'
            : SUPABASE_MISSING_CONFIG_MESSAGE}
        </Text>
      </View>
    )
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bgDark,
  },
  title: {
    marginTop: spacing.md,
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  message: {
    marginTop: spacing.sm,
    fontSize: font.md,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.textSecondary,
  },
})
