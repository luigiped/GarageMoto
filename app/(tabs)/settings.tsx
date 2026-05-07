// R1.1 - impostazioni con export CSV, notifiche test e stato runtime
import { useState } from 'react'
import { View, Text, TouchableOpacity, Alert, ScrollView, StyleSheet, ActivityIndicator, Switch } from 'react-native'
import { useAuthStore } from '../../src/store/authStore'
import { getDbMode, isUsingMemoryDb } from '../../src/db/client'
import { scheduleDebugNotification } from '../../src/services/notifications'
import { isSupabaseConfigured } from '../../src/services/supabase'
import { useAutoTripStore } from '../../src/store/autoTripStore'
import { useRefuelStore } from '../../src/store/refuelStore'
import { useTripStore } from '../../src/store/tripStore'
import { exportRefuels, exportTrips, shareCsv } from '../../src/utils/csvExporter'
import { sharePdfReport } from '../../src/utils/reportExporter'
import { useVehicleStore } from '../../src/store/vehicleStore'
import { colors, spacing, radius, font } from '../../src/theme'

export default function SettingsScreen() {
  const { user, signOut } = useAuthStore()
  const { activeVehicle } = useVehicleStore()
  const {
    enabled: autoTripEnabled,
    error: autoTripError,
    isBusy: autoTripBusy,
    isRecording: autoTripRecording,
    isTaskActive: autoTripTaskActive,
    setEnabled: setAutoTripEnabled,
    stopCurrentTrip,
  } = useAutoTripStore()
  const { refuels } = useRefuelStore()
  const { trips } = useTripStore()
  const [exporting, setExporting] = useState(false)
  const [sendingNotification, setSendingNotification] = useState(false)
  const localMode = !isSupabaseConfigured
  const dbMode = getDbMode()

  async function handleExportRefuels() {
    if (refuels.length === 0) { Alert.alert('Nessun dato', 'Non ci sono rifornimenti da esportare.'); return }
    setExporting(true)
    try {
      const csv = exportRefuels(refuels)
      await shareCsv(csv, 'rifornimenti.csv')
    } catch (e) {
      Alert.alert('Errore', 'Impossibile esportare il file.')
    } finally {
      setExporting(false)
    }
  }

  async function handleExportTrips() {
    if (trips.length === 0) { Alert.alert('Nessun dato', 'Non ci sono viaggi da esportare.'); return }
    setExporting(true)
    try {
      const csv = exportTrips(trips)
      await shareCsv(csv, 'viaggi.csv')
    } catch (e) {
      Alert.alert('Errore', 'Impossibile esportare il file.')
    } finally {
      setExporting(false)
    }
  }

  async function handleExportPdf() {
    if (!activeVehicle) {
      Alert.alert('Nessun veicolo', 'Seleziona prima un veicolo dal Garage.')
      return
    }
    if (refuels.length === 0 && trips.length === 0) {
      Alert.alert('Nessun dato', 'Non ci sono dati sufficienti per generare un report.')
      return
    }

    setExporting(true)
    try {
      await sharePdfReport({
        vehicle: activeVehicle,
        refuels,
        trips,
      })
    } catch (error) {
      console.error('[settings] export pdf:', error)
      Alert.alert(
        'Errore',
        'Impossibile esportare il PDF. Verifica di aver installato le dipendenze della release 1.3.',
      )
    } finally {
      setExporting(false)
    }
  }

  async function handleDebugNotification() {
    setSendingNotification(true)
    try {
      const scheduled = await scheduleDebugNotification()
      if (scheduled) {
        Alert.alert('Notifica programmata', 'Controlla il dispositivo tra 5 secondi.')
      } else {
        Alert.alert('Permesso negato', 'Le notifiche non sono abilitate su questo dispositivo.')
      }
    } catch (error) {
      console.error('[settings] debug notification:', error)
      Alert.alert('Errore', 'Impossibile programmare la notifica di test.')
    } finally {
      setSendingNotification(false)
    }
  }

  async function handleToggleAutoTrip(nextValue: boolean) {
    if (nextValue) {
      const confirmed = await confirmAutoTripEnable()
      if (!confirmed) {
        return
      }
    }

    const ok = await setAutoTripEnabled(nextValue)
    if (!ok && nextValue) {
      Alert.alert(
        'Permesso richiesto',
        'Per l’avvio automatico serve autorizzare il GPS anche in background nella development build.',
      )
    }
  }

  async function handleStopAutoTrip() {
    try {
      await stopCurrentTrip()
      Alert.alert('Viaggio chiuso', 'Il viaggio automatico corrente e stato salvato.')
    } catch (error) {
      Alert.alert('Errore', 'Impossibile fermare il viaggio automatico.')
    }
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

      {/* Account */}
      {user && (
        <>
          <Text style={s.section}>ACCOUNT</Text>
          <View style={s.card}>
            <Text style={s.cardMain}>{user.email}</Text>
            <Text style={s.cardSub}>
              {localMode ? 'Modalita locale di test' : 'Utente registrato'}
            </Text>
          </View>
        </>
      )}

      <Text style={s.section}>RUNTIME</Text>
      <View style={s.card}>
        <View style={s.rowBetween}>
          <Text style={s.cardSub}>Database attivo</Text>
          <Text style={s.cardMain}>{dbMode === 'memory' ? 'Fallback memoria' : 'SQLite locale'}</Text>
        </View>
        {isUsingMemoryDb() && (
          <Text style={[s.cardSub, { marginTop: spacing.sm }]}>
            I dati salvati in questa sessione non sono persistenti.
          </Text>
        )}
        <View style={s.divider} />
        <TouchableOpacity style={s.row} onPress={handleDebugNotification} disabled={sendingNotification}>
          {sendingNotification ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={s.rowIcon}>🔔</Text>}
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={s.cardMain}>Invia notifica di test</Text>
            <Text style={s.cardSub}>Verifica il canale notifiche locale</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={s.section}>VIAGGI</Text>
      <View style={s.card}>
        <View style={s.rowBetween}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text style={s.cardMain}>Avvio automatico viaggio</Text>
            <Text style={s.cardSub}>
              Registra automaticamente un viaggio quando rileva movimento in moto.
            </Text>
          </View>
          {autoTripBusy ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Switch
              value={autoTripEnabled}
              onValueChange={handleToggleAutoTrip}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          )}
        </View>
        <View style={s.divider} />
        <View style={s.rowBetween}>
          <Text style={s.cardSub}>Servizio movimento</Text>
          <Text style={s.cardMain}>{autoTripTaskActive ? 'Attivo' : 'Disattivo'}</Text>
        </View>
        <View style={s.rowBetween}>
          <Text style={s.cardSub}>Viaggio corrente</Text>
          <Text style={s.cardMain}>{autoTripRecording ? 'In registrazione' : 'Nessuno'}</Text>
        </View>
        {autoTripEnabled && (
          <Text style={[s.cardSub, { marginTop: spacing.sm }]}>
            Lo schermo puo spegnersi normalmente. Su Android, il rilevamento non e garantito se il sistema chiude completamente l'app.
          </Text>
        )}
        {autoTripError && (
          <Text style={[s.cardSub, { color: colors.warning, marginTop: spacing.sm }]}>
            {autoTripError}
          </Text>
        )}
        {autoTripRecording && (
          <>
            <View style={s.divider} />
            <TouchableOpacity style={s.row} onPress={handleStopAutoTrip}>
              <Text style={s.rowIcon}>⏹️</Text>
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={s.cardMain}>Ferma viaggio automatico</Text>
                <Text style={s.cardSub}>Chiude e salva subito il viaggio in corso</Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={s.section}>DATI</Text>
      <View style={s.card}>
        <TouchableOpacity style={s.row} onPress={handleExportRefuels} disabled={exporting}>
          {exporting ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={s.rowIcon}>📥</Text>}
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={s.cardMain}>Esporta rifornimenti CSV</Text>
            <Text style={s.cardSub}>{refuels.length} rifornimenti disponibili</Text>
          </View>
        </TouchableOpacity>
        <View style={s.divider} />
        <TouchableOpacity style={s.row} onPress={handleExportTrips} disabled={exporting}>
          {exporting ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={s.rowIcon}>📥</Text>}
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={s.cardMain}>Esporta viaggi CSV</Text>
            <Text style={s.cardSub}>{trips.length} viaggi disponibili</Text>
          </View>
        </TouchableOpacity>
        <View style={s.divider} />
        <TouchableOpacity style={s.row} onPress={handleExportPdf} disabled={exporting}>
          {exporting ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={s.rowIcon}>🧾</Text>}
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={s.cardMain}>Esporta report PDF</Text>
            <Text style={s.cardSub}>Riepilogo veicolo, consumi, viaggi e performance bonus</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* App info */}
      <Text style={s.section}>APP</Text>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.cardSub}>Versione</Text>
          <Text style={[s.cardMain, { marginLeft: 'auto' }]}>1.3.0</Text>
        </View>
      </View>

      {!localMode && (
        <TouchableOpacity style={s.logoutBtn} onPress={handleSignOut}>
          <Text style={s.logoutText}>Disconnetti</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

function confirmAutoTripEnable(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Attiva avvio automatico',
      'GarageMoto richiedera il GPS in background per avviare i viaggi automaticamente quando rileva movimento.',
      [
        { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continua', onPress: () => resolve(true) },
      ],
    )
  })
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: colors.bgDark },
  content:   { padding: spacing.md, paddingTop: 56, paddingBottom: spacing.xl },
  title:     { fontSize: font.xxl, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.lg },
  section:   { fontSize: font.sm, color: colors.primary, letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.md },
  card:      { backgroundColor: colors.surfaceDk, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  cardMain:  { color: colors.textPrimary, fontSize: font.base, fontWeight: '500' },
  cardSub:   { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  row:       { flexDirection: 'row', alignItems: 'center' },
  rowBetween:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowIcon:   { fontSize: 20 },
  divider:   { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  logoutBtn: { backgroundColor: 'rgba(255,59,48,0.1)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)', borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.xl },
  logoutText:{ color: colors.error, fontWeight: '600', fontSize: font.base },
})
