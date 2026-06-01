import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import { useAuthStore } from '../src/store/authStore'
import { handleSupabaseAuthRedirect } from '../src/services/supabase'
import { useTheme } from '../src/useTheme'

export default function ResetPasswordScreen() {
  const theme = useTheme()
  const styles = createStyles(theme)
  const { colors } = theme
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [isHandlingLink, setIsHandlingLink] = useState(false)
  const incomingUrl = Linking.useURL()
  const {
    session,
    isLoading,
    error,
    notice,
    updatePassword,
    signOut,
    clearError,
    clearNotice,
    setPasswordRecovery,
  } = useAuthStore()

  useEffect(() => {
    let mounted = true
    let consumed = false

    async function consumeResetLink(url: string) {
      if (!url.includes('token_hash=') && !url.includes('access_token=')) {
        return
      }

      setIsHandlingLink(true)
      setPasswordRecovery(true)
      setLocalError(null)
      clearError()
      clearNotice()

      try {
        consumed = true
        const result = await handleSupabaseAuthRedirect(url)
        if (!mounted) {
          return
        }

        if (!result.handled || result.kind !== 'password-recovery') {
          setPasswordRecovery(false)
          setLocalError('Questo link non e valido per il reset password.')
          return
        }

        if (!result.success || result.needsLogin) {
          setPasswordRecovery(false)
          setLocalError(result.error ?? 'Link di reset non valido o scaduto. Richiedine uno nuovo.')
        }
      } catch (linkError) {
        console.error('[reset-password] auth link:', linkError)
        if (mounted) {
          setPasswordRecovery(false)
          setLocalError('Si e verificato un errore durante l’apertura del link di reset.')
        }
      } finally {
        if (mounted) {
          setIsHandlingLink(false)
        }
      }
    }

    if (incomingUrl) {
      void consumeResetLink(incomingUrl)
    } else {
      Linking.getInitialURL()
        .then((initialUrl) => {
          if (!consumed && initialUrl) {
            void consumeResetLink(initialUrl)
          }
        })
        .catch((linkError) => {
          console.error('[reset-password] initial url:', linkError)
        })
    }

    return () => {
      mounted = false
    }
  }, [incomingUrl, clearError, clearNotice, setPasswordRecovery])

  async function handleUpdatePassword() {
    setLocalError(null)
    clearError()
    clearNotice()

    if (!session) {
      setLocalError('Apri il link di reset dalla tua email prima di impostare una nuova password.')
      return
    }

    if (!password.trim() || !confirm.trim()) {
      setLocalError('Compila entrambi i campi password.')
      return
    }

    if (password.length < 6) {
      setLocalError('La password deve essere di almeno 6 caratteri.')
      return
    }

    if (password !== confirm) {
      setLocalError('Le password non coincidono.')
      return
    }

    const ok = await updatePassword(password)
    if (ok) {
      router.replace('/login')
    }
  }

  async function goToLogin() {
    setPasswordRecovery(false)
    if (session) {
      await signOut()
    }
    router.replace('/login')
  }

  const displayError = localError ?? error

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>🏍️</Text>
          <Text style={styles.title}>Nuova password</Text>
          <Text style={styles.subtitle}>Imposta una nuova password per il tuo account.</Text>
        </View>

        {displayError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{displayError}</Text>
          </View>
        ) : null}

        {notice ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        {isHandlingLink ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>Sto verificando il link di reset...</Text>
          </View>
        ) : null}

        {!session && !isHandlingLink ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              Nessuna richiesta di reset attiva. Torna al login, inserisci la tua email e richiedi un nuovo link.
            </Text>
          </View>
        ) : null}

        <Text style={styles.label}>Nuova password</Text>
        <TextInput
          style={styles.input}
          placeholder="Minimo 6 caratteri"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={styles.label}>Conferma nuova password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={colors.textMuted}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.btn, !session ? styles.btnDisabled : null]}
          onPress={handleUpdatePassword}
          disabled={isLoading || isHandlingLink || !session}
        >
          {isLoading || isHandlingLink
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Aggiorna password</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.link} onPress={goToLogin}>
          <Text style={styles.linkText}>
            Torna al <Text style={{ color: colors.primary }}>login</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  const { colors, spacing, radius, font } = theme

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgDark },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
    header: { alignItems: 'center', marginBottom: spacing.xl },
    logo: { fontSize: 56, marginBottom: spacing.sm },
    title: { fontSize: font.xxl, fontWeight: 'bold', color: colors.textPrimary },
    subtitle: {
      marginTop: spacing.sm,
      fontSize: font.md,
      lineHeight: 20,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    label: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 4 },
    input: {
      backgroundColor: colors.surfaceDk,
      color: colors.textPrimary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      fontSize: font.base,
      marginBottom: spacing.md,
    },
    btn: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: '#fff', fontWeight: '600', fontSize: font.base },
    link: { marginTop: spacing.md, alignItems: 'center' },
    linkText: { color: colors.textSecondary, fontSize: font.md },
    errorBox: {
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
    noticeText: { color: colors.textPrimary, fontSize: font.sm, lineHeight: 20 },
  })
}
