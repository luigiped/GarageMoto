import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet,
} from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../src/store/authStore'
import { useTheme } from '../../src/useTheme'

export default function RegisterScreen() {
  const theme = useTheme()
  const styles = createStyles(theme)
  const { colors } = theme
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const { signUpWithEmail, isLoading, error, notice, clearError, clearNotice } = useAuthStore()

  async function handleRegister() {
    setLocalError(null)
    clearError()
    clearNotice()
    if (!email.trim() || !password.trim()) { setLocalError('Compila tutti i campi'); return }
    if (password !== confirm) { setLocalError('Le password non coincidono'); return }
    if (password.length < 6) { setLocalError('Password di almeno 6 caratteri'); return }
    const ok = await signUpWithEmail(email.trim().toLowerCase(), password)
    if (ok) {
      router.replace('/login')
    }
  }

  const displayError = localError ?? error

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>🏍️</Text>
          <Text style={styles.title}>Crea account</Text>
        </View>

        {displayError ? (
          <View style={styles.errorBox}><Text style={styles.errorText}>{displayError}</Text></View>
        ) : null}

        {notice ? (
          <View style={styles.noticeBox}><Text style={styles.noticeText}>{notice}</Text></View>
        ) : null}

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} placeholder="la-tua@email.com" placeholderTextColor={colors.textMuted}
          value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} placeholder="Minimo 6 caratteri" placeholderTextColor={colors.textMuted}
          value={password} onChangeText={setPassword} secureTextEntry />

        <Text style={styles.label}>Conferma password</Text>
        <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor={colors.textMuted}
          value={confirm} onChangeText={setConfirm} secureTextEntry />

        <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Registrati</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.link} onPress={() => router.back()}>
          <Text style={styles.linkText}>Hai già un account? <Text style={{ color: colors.primary }}>Accedi</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  const { colors, spacing, radius, font } = theme

  return StyleSheet.create({
    root:     { flex: 1, backgroundColor: colors.bgDark },
    scroll:   { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
    header:   { alignItems: 'center', marginBottom: spacing.xl },
    logo:     { fontSize: 56, marginBottom: spacing.sm },
    title:    { fontSize: font.xxl, fontWeight: 'bold', color: colors.textPrimary },
    label:    { fontSize: font.sm, color: colors.textSecondary, marginBottom: 4 },
    input:    { backgroundColor: colors.surfaceDk, color: colors.textPrimary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: font.base, marginBottom: spacing.md },
    btn:      { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: spacing.sm },
    btnText:  { color: '#fff', fontWeight: '600', fontSize: font.base },
    link:     { marginTop: spacing.lg, alignItems: 'center' },
    linkText: { color: colors.textSecondary, fontSize: font.md },
    errorBox: { backgroundColor: 'rgba(255,59,48,0.1)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.4)', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
    errorText:{ color: colors.error, fontSize: font.sm },
    noticeBox:{ backgroundColor: colors.infoSurface, borderWidth: 1, borderColor: colors.infoEdge, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
    noticeText:{ color: colors.textPrimary, fontSize: font.sm, lineHeight: 20 },
  })
}
