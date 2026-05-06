import { View, Text, TouchableOpacity, Alert, ScrollView, StyleSheet } from 'react-native'
import { useAuthStore } from '../../src/store/authStore'
import { isSupabaseConfigured } from '../../src/services/supabase'
import { scheduleDebugNotification } from '../../src/services/notifications'
import { colors, spacing, radius, font } from '../../src/theme'

export default function SettingsScreen() {
  const { user, signOut } = useAuthStore()

  async function handleTestNotification() {
    const scheduled = await scheduleDebugNotification()
    Alert.alert(
      scheduled ? 'Notifica programmata' : 'Notifica non disponibile',
      scheduled
        ? 'Se i permessi sono concessi, riceverai una notifica tra 5 secondi.'
        : 'Impossibile programmare la notifica su questo runtime.',
    )
  }

  function handleSignOut() {
    Alert.alert('Disconnetti', 'Vuoi davvero disconnetterti?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Disconnetti', style: 'destructive', onPress: signOut },
    ])
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.title}>Impostazioni</Text>

      {user && (
        <>
          <Text style={s.sectionLabel}>ACCOUNT</Text>
          <View style={s.card}>
            <Text style={s.cardMain}>{user.email}</Text>
            <Text style={s.cardSub}>
              {isSupabaseConfigured ? 'Utente registrato' : 'Modalita locale di test'}
            </Text>
          </View>
        </>
      )}

      <Text style={s.sectionLabel}>APP</Text>
      <View style={s.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={s.cardSub}>Versione</Text>
          <Text style={s.cardMain}>1.0.0</Text>
        </View>
      </View>

      <Text style={s.sectionLabel}>NOTIFICHE</Text>
      <TouchableOpacity style={s.card} onPress={handleTestNotification}>
        <Text style={s.cardMain}>Invia notifica di test</Text>
        <Text style={s.cardSub}>Programma una notifica locale tra 5 secondi</Text>
      </TouchableOpacity>

      {isSupabaseConfigured && (
        <TouchableOpacity style={s.logoutBtn} onPress={handleSignOut}>
          <Text style={s.logoutText}>Disconnetti</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: colors.bgDark },
  content:      { padding: spacing.md, paddingTop: 56, paddingBottom: spacing.xl },
  title:        { fontSize: font.xxl, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.lg },
  sectionLabel: { fontSize: font.sm, color: colors.primary, letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.md },
  card:         { backgroundColor: colors.surfaceDk, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  cardMain:     { color: colors.textPrimary, fontSize: font.base, fontWeight: '500' },
  cardSub:      { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  logoutBtn:    { backgroundColor: 'rgba(255,59,48,0.1)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)', borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.xl },
  logoutText:   { color: colors.error, fontWeight: '600', fontSize: font.base },
})
