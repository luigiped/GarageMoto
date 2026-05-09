import { useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { ActionButton } from '../../src/components/ui/ActionButton'
import { AppScreen } from '../../src/components/ui/AppScreen'
import { Panel } from '../../src/components/ui/Panel'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { StatusPill } from '../../src/components/ui/StatusPill'
import { getDbMode, isUsingMemoryDb } from '../../src/db/client'
import { scheduleDebugNotification } from '../../src/services/notifications'
import { isSupabaseConfigured } from '../../src/services/supabase'
import { useAuthStore } from '../../src/store/authStore'
import { useAutoTripStore } from '../../src/store/autoTripStore'
import { useRefuelStore } from '../../src/store/refuelStore'
import { useTripStore } from '../../src/store/tripStore'
import { useVehicleStore } from '../../src/store/vehicleStore'
import { colorTheme, colors, designPreset, font, spacing } from '../../src/theme'
import { exportRefuels, exportTrips, shareCsv } from '../../src/utils/csvExporter'
import { sharePdfReport } from '../../src/utils/reportExporter'

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
    if (refuels.length === 0) {
      Alert.alert('Nessun dato', 'Non ci sono rifornimenti da esportare.')
      return
    }
    setExporting(true)
    try {
      await shareCsv(exportRefuels(refuels), 'rifornimenti.csv')
    } catch {
      Alert.alert('Errore', 'Impossibile esportare il file CSV dei rifornimenti.')
    } finally {
      setExporting(false)
    }
  }

  async function handleExportTrips() {
    if (trips.length === 0) {
      Alert.alert('Nessun dato', 'Non ci sono viaggi da esportare.')
      return
    }
    setExporting(true)
    try {
      await shareCsv(exportTrips(trips), 'viaggi.csv')
    } catch {
      Alert.alert('Errore', 'Impossibile esportare il file CSV dei viaggi.')
    } finally {
      setExporting(false)
    }
  }

  async function handleExportPdf() {
    if (!activeVehicle) {
      Alert.alert('Nessun veicolo', 'Seleziona prima una moto dal Garage.')
      return
    }
    if (refuels.length === 0 && trips.length === 0) {
      Alert.alert('Nessun dato', 'Non ci sono dati sufficienti per generare il report.')
      return
    }
    setExporting(true)
    try {
      await sharePdfReport({ vehicle: activeVehicle, refuels, trips })
    } catch (error) {
      console.error('[settings] export pdf:', error)
      Alert.alert('Errore', 'Impossibile esportare il report PDF.')
    } finally {
      setExporting(false)
    }
  }

  async function handleDebugNotification() {
    setSendingNotification(true)
    try {
      const scheduled = await scheduleDebugNotification()
      Alert.alert(
        scheduled ? 'Notifica programmata' : 'Permesso negato',
        scheduled ? 'Controlla il dispositivo tra 5 secondi.' : 'Le notifiche non sono abilitate su questo dispositivo.',
      )
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
      Alert.alert('Permesso richiesto', 'Per l’avvio automatico serve il GPS anche in background nella development build.')
    }
  }

  async function handleStopAutoTrip() {
    try {
      await stopCurrentTrip()
      Alert.alert('Viaggio chiuso', 'Il viaggio automatico corrente e stato salvato.')
    } catch {
      Alert.alert('Errore', 'Impossibile fermare il viaggio automatico.')
    }
  }

  function handleSignOut() {
    Alert.alert('Disconnetti', 'Vuoi davvero disconnetterti?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Disconnetti', style: 'destructive', onPress: signOut },
    ])
  }

  function handleChangeAccount() {
    if (localMode) {
      Alert.alert(
        'Account locale',
        'Supabase Auth non e ancora configurato. Quando attiverai l’accesso reale, qui potrai cambiare account.',
      )
      return
    }
    handleSignOut()
  }

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Setup"
        title="Impostazioni"
        subtitle="Stato runtime, export dati, notifiche e tracking automatico raccolti in pannelli piu leggibili."
      />

      {user && (
        <Panel title="Account" subtitle={localMode ? 'Modalita locale di test' : 'Sessione utente attiva'}>
          <Text style={styles.accountMail}>{user.email}</Text>
          <View style={styles.rowGap}>
            <StatusPill label={localMode ? 'Locale' : 'Supabase'} tone={localMode ? 'info' : 'success'} />
          </View>
          <View style={styles.accountActionWrap}>
            <ActionButton
              label={localMode ? 'Configura accesso account' : 'Cambia account'}
              variant="secondary"
              onPress={handleChangeAccount}
            />
          </View>
        </Panel>
      )}

      <Panel title="Runtime" subtitle="Panoramica del motore locale, fallback e canale notifiche.">
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Database attivo</Text>
          <Text style={styles.infoValue}>{dbMode === 'memory' ? 'Fallback memoria' : 'SQLite locale'}</Text>
        </View>
        {isUsingMemoryDb() && (
          <Text style={styles.warningText}>I dati salvati in questa sessione non sono persistenti.</Text>
        )}
        <ActionButton
          label="Invia notifica di test"
          variant="secondary"
          onPress={handleDebugNotification}
          loading={sendingNotification}
        />
      </Panel>

      <Panel title="Viaggi automatici" subtitle="Gestione tracking in background e stato del servizio.">
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Auto tracking</Text>
          <StatusPill label={autoTripEnabled ? 'Attivo' : 'Disattivo'} tone={autoTripEnabled ? 'success' : 'default'} />
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Servizio movimento</Text>
          <Text style={styles.infoValue}>{autoTripTaskActive ? 'Attivo' : 'Disattivo'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Viaggio corrente</Text>
          <Text style={styles.infoValue}>{autoTripRecording ? 'In registrazione' : 'Nessuno'}</Text>
        </View>
        {autoTripError ? <Text style={styles.errorText}>{autoTripError}</Text> : null}
        <Text style={styles.noteText}>
          Lo schermo puo spegnersi normalmente. Su Android il sistema puo comunque limitare il rilevamento se chiude l’app.
        </Text>
        <View style={styles.actionsCol}>
          <ActionButton
            label={autoTripEnabled ? 'Disattiva avvio automatico' : 'Attiva avvio automatico'}
            variant={autoTripEnabled ? 'secondary' : 'primary'}
            onPress={() => { void handleToggleAutoTrip(!autoTripEnabled) }}
            loading={autoTripBusy}
          />
          {autoTripRecording ? (
            <ActionButton label="Ferma viaggio automatico" variant="danger" onPress={() => { void handleStopAutoTrip() }} />
          ) : null}
        </View>
      </Panel>

      <Panel title="Dati ed export" subtitle="Condivisione file CSV e report PDF della moto attiva.">
        <View style={styles.actionsCol}>
          <ActionButton label={`Esporta rifornimenti CSV · ${refuels.length}`} variant="secondary" onPress={handleExportRefuels} loading={exporting} />
          <ActionButton label={`Esporta viaggi CSV · ${trips.length}`} variant="secondary" onPress={handleExportTrips} loading={exporting} />
          <ActionButton label="Esporta report PDF" variant="primary" onPress={handleExportPdf} loading={exporting} />
        </View>
      </Panel>

      <Panel title="Configurazione" subtitle="Riepilogo rapido del profilo runtime attuale.">
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Sync</Text>
          <Text style={styles.infoValue}>{localMode ? 'Locale' : 'Supabase'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Stile UI</Text>
          <Text style={styles.infoValue}>{designPreset}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tema colore</Text>
          <Text style={styles.infoValue}>{colorTheme}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tracking</Text>
          <Text style={styles.infoValue}>{autoTripEnabled ? 'Attivo' : 'Disattivo'}</Text>
        </View>
      </Panel>
    </AppScreen>
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

const styles = StyleSheet.create({
  accountMail: {
    color: colors.textPrimary,
    fontSize: font.lg,
    fontWeight: '700',
  },
  rowGap: {
    marginTop: spacing.sm,
  },
  accountActionWrap: {
    marginTop: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: font.base,
    flex: 1,
  },
  infoValue: {
    color: colors.textPrimary,
    fontSize: font.base,
    fontWeight: '700',
    textAlign: 'right',
  },
  noteText: {
    color: colors.textMuted,
    fontSize: font.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  warningText: {
    color: colors.warning,
    fontSize: font.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: font.sm,
    marginBottom: spacing.md,
  },
  actionsCol: {
    gap: spacing.sm,
  },
})
