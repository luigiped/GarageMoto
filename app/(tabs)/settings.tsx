// R1.3 - include manutenzione nel report PDF e mantiene il pannello export coerente con i dati reali dell'utente.
import { useEffect, useState } from 'react'
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { ActionButton } from '../../src/components/ui/ActionButton'
import { AppScreen } from '../../src/components/ui/AppScreen'
import { Panel } from '../../src/components/ui/Panel'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { SelectField } from '../../src/components/ui/SelectField'
import { StatusPill } from '../../src/components/ui/StatusPill'
import { getDb, getDbMode, isUsingMemoryDb } from '../../src/db/client'
import { scheduleDebugNotification } from '../../src/services/notifications'
import { countPendingDeletes } from '../../src/services/syncQueue'
import { isSupabaseConfigured } from '../../src/services/supabase'
import { useAuthStore } from '../../src/store/authStore'
import { useAutoTripStore } from '../../src/store/autoTripStore'
import { useMaintenanceStore } from '../../src/store/maintenanceStore'
import { useRefuelStore } from '../../src/store/refuelStore'
import { useThemeStore } from '../../src/store/themeStore'
import { useTripStore } from '../../src/store/tripStore'
import { useVehicleStore } from '../../src/store/vehicleStore'
import {
  AVAILABLE_COLOR_THEMES,
  AVAILABLE_UI_STYLES,
  type ColorTheme,
  type UiStyle,
} from '../../src/theme'
import { useTheme } from '../../src/useTheme'
import { exportRefuels, exportTrips, shareCsv } from '../../src/utils/csvExporter'
import { sharePdfReport } from '../../src/utils/reportExporter'

const THEME_LABELS: Record<ColorTheme, string> = {
  rally: 'Rally',
  cobalt: 'Cobalt',
  rosso: 'Rosso corsa',
  emerald: 'Emerald trail',
  titanium: 'Titanium',
  violet: 'Dark violet',
  giallo: 'Giallo corsa',
}

const UI_STYLE_LABELS: Record<UiStyle, string> = {
  glass: 'Glass',
  rally: 'Rally',
}

type SyncSummary = {
  vehicles: number
  refuels: number
  maintenance: number
  trips: number
  deletes: number
}

export default function SettingsScreen() {
  const { user, signOut } = useAuthStore()
  const theme = useTheme()
  const styles = createStyles(theme)
  const colorTheme = useThemeStore((state) => state.colorTheme)
  const designPreset = useThemeStore((state) => state.uiStyle)
  const setColorTheme = useThemeStore((state) => state.setColorTheme)
  const setUiStyle = useThemeStore((state) => state.setUiStyle)
  const { activeVehicle, loadVehicles } = useVehicleStore()
  const {
    enabled: autoTripEnabled,
    error: autoTripError,
    isBusy: autoTripBusy,
    isRecording: autoTripRecording,
    isTaskActive: autoTripTaskActive,
    setEnabled: setAutoTripEnabled,
    stopCurrentTrip,
  } = useAutoTripStore()
  const { refuels, loadRefuels } = useRefuelStore()
  const { items: maintenanceItems, loadMaintenance } = useMaintenanceStore()
  const { trips, loadTrips } = useTripStore()
  const [exporting, setExporting] = useState(false)
  const [sendingNotification, setSendingNotification] = useState(false)
  const [syncingNow, setSyncingNow] = useState(false)
  const [syncSummary, setSyncSummary] = useState<SyncSummary>({
    vehicles: 0,
    refuels: 0,
    maintenance: 0,
    trips: 0,
    deletes: 0,
  })
  const localMode = !isSupabaseConfigured
  const dbMode = getDbMode()
  const totalPendingSync =
    syncSummary.vehicles + syncSummary.refuels + syncSummary.maintenance + syncSummary.trips + syncSummary.deletes

  useEffect(() => {
    void refreshSyncSummary()
  }, [user?.id, activeVehicle?.id])

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
    if (refuels.length === 0 && trips.length === 0 && maintenanceItems.length === 0) {
      Alert.alert('Nessun dato', 'Non ci sono dati sufficienti per generare il report.')
      return
    }
    setExporting(true)
    try {
      await loadMaintenance(activeVehicle.id)
      await sharePdfReport({
        vehicle: activeVehicle,
        refuels,
        trips,
        maintenance: useMaintenanceStore.getState().items,
      })
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

  async function handleSelectColorTheme(nextTheme: ColorTheme) {
    if (nextTheme === colorTheme) {
      return
    }

    try {
      await setColorTheme(nextTheme)
    } catch (error) {
      console.error('[settings] select theme:', error)
      Alert.alert('Errore', 'Impossibile salvare il tema colore selezionato.')
    }
  }

  async function handleSelectUiStyle(nextStyle: UiStyle) {
    if (nextStyle === designPreset) {
      return
    }

    try {
      await setUiStyle(nextStyle)
    } catch (error) {
      console.error('[settings] select ui style:', error)
      Alert.alert('Errore', 'Impossibile salvare lo stile interfaccia selezionato.')
    }
  }

  async function refreshSyncSummary() {
    try {
      const summary = await loadPendingSyncSummary(user?.id ?? null, activeVehicle?.id ?? null)
      setSyncSummary(summary)
    } catch (error) {
      console.error('[settings] refresh sync summary:', error)
    }
  }

  async function handleForceSync() {
    if (!user?.id) {
      Alert.alert('Account richiesto', 'Accedi con un account reale per sincronizzare i dati.')
      return
    }

    setSyncingNow(true)
    try {
      await loadVehicles(user.id)

      if (activeVehicle?.id) {
        await Promise.all([
          loadRefuels(activeVehicle.id),
          loadMaintenance(activeVehicle.id),
          loadTrips(activeVehicle.id),
        ])
      }

      const summary = await loadPendingSyncSummary(user.id, activeVehicle?.id ?? null)
      setSyncSummary(summary)
      Alert.alert(
        summaryTotal(summary) === 0 ? 'Sync completata' : 'Sync parziale',
        summaryTotal(summary) === 0
          ? 'La coda locale sync_pending risulta vuota.'
          : `Restano ${summaryTotal(summary)} record locali in attesa di sincronizzazione.`,
      )
    } catch (error) {
      console.error('[settings] force sync:', error)
      Alert.alert('Errore', 'Impossibile completare la sincronizzazione forzata.')
    } finally {
      setSyncingNow(false)
    }
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

      <Panel title="Tema colore" subtitle="Seleziona una palette. Il layout UX resta nello stile attuale.">
        <SelectField
          label="Palette attiva"
          value={colorTheme}
          onChange={(nextValue) => { void handleSelectColorTheme(nextValue as ColorTheme) }}
          options={AVAILABLE_COLOR_THEMES.map((themeName) => ({
            value: themeName,
            label: THEME_LABELS[themeName],
          }))}
        />
      </Panel>

      <Panel
        title="Stile interfaccia"
        subtitle="Scegli il layout visuale generale dell’app tra variante glass e rally."
      >
        <SelectField
          label="Stile attivo"
          value={designPreset}
          onChange={(nextValue) => { void handleSelectUiStyle(nextValue as UiStyle) }}
          options={AVAILABLE_UI_STYLES.map((styleName) => ({
            value: styleName,
            label: UI_STYLE_LABELS[styleName],
          }))}
        />
      </Panel>

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

      <Panel
        title="Sync locale"
        subtitle="Conteggio dei record locali ancora marcati sync_pending e sincronizzazione forzata."
      >
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Record in coda</Text>
          <StatusPill
            label={totalPendingSync === 0 ? 'Coda vuota' : `${totalPendingSync} pending`}
            tone={totalPendingSync === 0 ? 'success' : 'warning'}
          />
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Veicoli</Text>
          <Text style={styles.infoValue}>{syncSummary.vehicles}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Rifornimenti</Text>
          <Text style={styles.infoValue}>{syncSummary.refuels}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Manutenzioni</Text>
          <Text style={styles.infoValue}>{syncSummary.maintenance}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Viaggi</Text>
          <Text style={styles.infoValue}>{syncSummary.trips}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Cancellazioni</Text>
          <Text style={styles.infoValue}>{syncSummary.deletes}</Text>
        </View>
        <View style={styles.actionsCol}>
          <ActionButton
            label="Sincronizza adesso"
            variant="primary"
            onPress={() => { void handleForceSync() }}
            loading={syncingNow}
          />
          <ActionButton
            label="Aggiorna stato sync"
            variant="secondary"
            onPress={() => { void refreshSyncSummary() }}
          />
        </View>
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

async function loadPendingSyncSummary(
  userId: string | null,
  vehicleId: string | null,
): Promise<SyncSummary> {
  const db = getDb()
  const [vehicles, refuels, maintenance, trips, deletes] = await Promise.all([
    userId
      ? countRows(db, 'SELECT COUNT(*) as count FROM vehicles WHERE user_id=? AND sync_pending=1', [userId])
      : Promise.resolve(0),
    vehicleId
      ? countRows(db, 'SELECT COUNT(*) as count FROM refuels WHERE vehicle_id=? AND sync_pending=1', [vehicleId])
      : Promise.resolve(0),
    vehicleId
      ? countRows(db, 'SELECT COUNT(*) as count FROM maintenance WHERE vehicle_id=? AND sync_pending=1', [vehicleId])
      : Promise.resolve(0),
    vehicleId
      ? countRows(db, 'SELECT COUNT(*) as count FROM trips WHERE vehicle_id=? AND sync_pending=1', [vehicleId])
      : Promise.resolve(0),
    countPendingDeletes(),
  ])

  return { vehicles, refuels, maintenance, trips, deletes }
}

async function countRows(
  db: ReturnType<typeof getDb>,
  sql: string,
  params: Array<string | number>,
): Promise<number> {
  const rows = await db.getAllAsync<{ count: number }>(sql, params)
  return rows[0]?.count ?? 0
}

function summaryTotal(summary: SyncSummary): number {
  return summary.vehicles + summary.refuels + summary.maintenance + summary.trips + summary.deletes
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  const { colors, font, spacing } = theme

  return StyleSheet.create({
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
}
