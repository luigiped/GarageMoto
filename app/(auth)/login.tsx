import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet,
} from 'react-native'
import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import { useAuthStore } from '../../src/store/authStore'
import { handleSupabaseAuthRedirect } from '../../src/services/supabase'
import { useTheme } from '../../src/useTheme'

export default function LoginScreen() {
  const theme = useTheme()
  const styles = createStyles(theme)
  const { colors } = theme
  const incomingUrl = Linking.useURL()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [isHandlingLink, setIsHandlingLink] = useState(false)
  const {
    signInWithEmail,
    isLoading,
    error,
    notice,
    clearError,
    clearNotice,
  } = useAuthStore()

  useEffect(() => {
    let mounted = true
    let consumed = false

    async function consumeAuthLink(url: string) {
      if (!url.includes('token_hash=') && !url.includes('access_token=')) {
        return
      }

      setIsHandlingLink(true)
      clearError()
      clearNotice()

      try {
        consumed = true
        const result = await handleSupabaseAuthRedirect(url)
        if (!mounted) {
          return
        }

        if (!result.handled) {
          setLocalError('Non sono riuscito a leggere il link di conferma.')
          return
        }

        if (!result.success) {
          setLocalError(result.error ?? 'Conferma email non riuscita.')
          return
        }

        if (result.needsLogin) {
          useAuthStore.setState({
            notice: 'Email confermata correttamente. Ora accedi con le tue credenziali.',
            error: null,
          })
          return
        }

        useAuthStore.setState({
          notice: 'Accesso completato. Reindirizzamento in corso...',
          error: null,
        })
      } catch (linkError) {
        console.error('[login] auth link:', linkError)
        if (mounted) {
          setLocalError('Si è verificato un errore durante la conferma dell’account.')
        }
      } finally {
        if (mounted) {
          setIsHandlingLink(false)
        }
      }
    }

    if (incomingUrl) {
      void consumeAuthLink(incomingUrl)
    } else {
      Linking.getInitialURL()
        .then((initialUrl) => {
          if (!consumed && initialUrl) {
            void consumeAuthLink(initialUrl)
          }
        })
        .catch((linkError) => {
          console.error('[login] initial url:', linkError)
        })
    }

    return () => {
      mounted = false
    }
  }, [incomingUrl, clearError, clearNotice])

  async function handleLogin() {
    setLocalError(null)
    if (!email.trim() || !password.trim()) {
      setLocalError('Inserisci email e password per accedere.')
      return
    }
    clearError()
    clearNotice()
    await signInWithEmail(email.trim().toLowerCase(), password)
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>🏍️</Text>
          <Text style={styles.title}>GarageMoto</Text>
          <Text style={styles.subtitle}>Il tuo cruscotto digitale</Text>
        </View>

        {error || localError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{localError ?? error}</Text>
          </View>
        ) : null}

        {notice ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="la-tua@email.com"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={isLoading}>
          {isLoading || isHandlingLink
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Accedi</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.link} onPress={() => router.push('/register')}>
          <Text style={styles.linkText}>
            Non hai un account? <Text style={{ color: colors.primary }}>Registrati</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  const { colors, spacing, radius, font } = theme

  return StyleSheet.create({
    root:      { flex: 1, backgroundColor: colors.bgDark },
    scroll:    { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
    header:    { alignItems: 'center', marginBottom: spacing.xl },
    logo:      { fontSize: 56, marginBottom: spacing.sm },
    title:     { fontSize: font.xxxl, fontWeight: 'bold', color: colors.textPrimary },
    subtitle:  { fontSize: font.md, color: colors.textSecondary, marginTop: 4 },
    label:     { fontSize: font.sm, color: colors.textSecondary, marginBottom: 4 },
    input:     {
      backgroundColor: colors.surfaceDk,
      color: colors.textPrimary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      fontSize: font.base,
      marginBottom: spacing.md,
    },
    btn:       {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    btnText:   { color: '#fff', fontWeight: '600', fontSize: font.base },
    link:      { marginTop: spacing.lg, alignItems: 'center' },
    linkText:  { color: colors.textSecondary, fontSize: font.md },
    errorBox:  {
      backgroundColor: 'rgba(255,59,48,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255,59,48,0.4)',
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    errorText: { color: colors.error, fontSize: font.sm },
    noticeBox: {
      backgroundColor: colors.infoSurface,
      borderWidth: 1,
      borderColor: colors.infoEdge,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    noticeText: {
      color: colors.textPrimary,
      fontSize: font.sm,
      lineHeight: 20,
    },
  })
}
