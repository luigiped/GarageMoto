import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet,
} from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../src/store/authStore'
import { colors, spacing, radius, font } from '../../src/theme'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signInWithEmail, isLoading, error, clearError } = useAuthStore()

  async function handleLogin() {
    if (!email.trim() || !password.trim()) return
    clearError()
    await signInWithEmail(email.trim().toLowerCase(), password)
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Text style={s.logo}>🏍️</Text>
          <Text style={s.title}>GarageMoto</Text>
          <Text style={s.subtitle}>Il tuo cruscotto digitale</Text>
        </View>

        {error ? (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={s.label}>Email</Text>
        <TextInput
          style={s.input}
          placeholder="la-tua@email.com"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={s.label}>Password</Text>
        <TextInput
          style={s.input}
          placeholder="••••••••"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={isLoading}>
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Accedi</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.link} onPress={() => router.push('/(auth)/register')}>
          <Text style={s.linkText}>
            Non hai un account? <Text style={{ color: colors.primary }}>Registrati</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
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
})
