import { useEffect, useRef, useState } from 'react'
import Constants from 'expo-constants'
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps'
import { ActionButton } from '../../src/components/ui/ActionButton'
import { AppScreen } from '../../src/components/ui/AppScreen'
import { Panel } from '../../src/components/ui/Panel'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { StatusPill } from '../../src/components/ui/StatusPill'
import { useAuthStore } from '../../src/store/authStore'
import { useAutoTripStore } from '../../src/store/autoTripStore'
import { useTripStore } from '../../src/store/tripStore'
import { useVehicleStore } from '../../src/store/vehicleStore'
import { useTheme } from '../../src/useTheme'
import type { RoutePoint } from '../../src/types/trip'
import { formatDate } from '../../src/utils/formatters'
import { computeMaxBrakingG } from '../../src/utils/tripMetrics'
import {
  calibrateLeanAngle,
  createLeanAngleSummary,
  hasLeanAngleCalibration,
  isLeanAngleAvailable,
  startLeanAngleTracking,
  stopLeanAngleTracking,
  updateLeanAngleSummary,
  type LeanAngleSummary,
} from '../../src/services/leanAngleService'
import { requestLocationPermission, startTracking, stopTracking, validateTrip } from '../../src/services/location'

type Screen = 'list' | 'recording' | 'detail'

type ExpoAndroidMapsConfig = {
  android?: {
    config?: {
      googleMaps?: {
        apiKey?: string
      }
    }
  }
}

export default function TripsScreen() {
  const theme = useTheme()
  const styles = createStyles(theme)
  const { colors, designPreset } = theme
  const { user } = useAuthStore()
  const { enabled: autoTripEnabled, isRecording: autoTripRecording, stopCurrentTrip } = useAutoTripStore()
  const { activeVehicle } = useVehicleStore()
  const { trips, loadTrips, saveTrip, deleteTrip } = useTripStore()

  const [screen, setScreen] = useState<Screen>('list')
  const [points, setPoints] = useState<RoutePoint[]>([])
  const [startTs, setStartTs] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [currentSpeed, setSpeed] = useState(0)
  const [maxSpeed, setMaxSpeed] = useState(0)
  const [currentLeanAngle, setCurrentLeanAngle] = useState<number | null>(null)
  const [leanSummary, setLeanSummary] = useState<LeanAngleSummary>(createLeanAngleSummary())
  const [leanCalibrated, setLeanCalibrated] = useState(false)
  const [leanAvailable, setLeanAvailable] = useState<boolean | null>(null)
  const [isCalibratingLean, setIsCalibratingLean] = useState(false)
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null)

  const mapRef = useRef<MapView>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { width } = useWindowDimensions()
  const mapHeight = Math.round(width * 0.68)
  const expoConfig = Constants.expoConfig as ExpoAndroidMapsConfig | null
  const canRenderNativeMap = Platform.OS !== 'android' || Boolean(expoConfig?.android?.config?.googleMaps?.apiKey)

  useEffect(() => {
    if (activeVehicle?.id) {
      loadTrips(activeVehicle.id)
    }
  }, [activeVehicle?.id, loadTrips])

  useEffect(() => {
    void syncLeanStatus()
  }, [])

  useEffect(() => {
    if (screen === 'recording') {
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTs) / 1000)), 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [screen, startTs])

  async function handleStart() {
    if (!activeVehicle?.id || !user?.id) {
      Alert.alert('Viaggio non disponibile', 'Seleziona prima un veicolo attivo.')
      return
    }
    const confirmed = await confirmTrackingStart()
    if (!confirmed) {
      return
    }
    const granted = await requestLocationPermission()
    if (!granted) {
      Alert.alert('Permesso GPS', 'GarageMoto ha bisogno del GPS attivo per registrare il percorso.')
      return
    }

    try {
      if (leanAvailable && !leanCalibrated) {
        Alert.alert('Calibrazione richiesta', 'Calibra prima l’angolo di piega dalla card dedicata in questa schermata.')
        return
      }

      const ts = Date.now()
      setStartTs(ts)
      setPoints([])
      setSpeed(0)
      setMaxSpeed(0)
      setElapsed(0)
      setCurrentLeanAngle(null)
      setLeanSummary(createLeanAngleSummary())
      setScreen('recording')
      await startTracking((point) => {
        setPoints((prev) => {
          const next = [...prev, point]
          mapRef.current?.animateToRegion({
            latitude: point.lat,
            longitude: point.lng,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }, 500)
          return next
        })
        setSpeed(Math.round(point.speedKmh))
        setMaxSpeed((prev) => Math.max(prev, point.speedKmh))
      })
      if (leanAvailable && leanCalibrated) {
        await startLeanAngleTracking((sample) => {
          setCurrentLeanAngle(sample.correctedAngleDeg)
          setLeanSummary((prev) => updateLeanAngleSummary(prev, sample.correctedAngleDeg))
        })
      }
    } catch (error) {
      console.error('[trips] startTracking:', error)
      stopTracking()
      stopLeanAngleTracking()
      setScreen('list')
      Alert.alert('Errore GPS', 'Impossibile avviare la registrazione del viaggio.')
    }
  }

  async function handleStop() {
    stopTracking()
    stopLeanAngleTracking()
    const endTs = Date.now()
    setScreen('list')

    if (!user?.id || !activeVehicle?.id) {
      return
    }

    const validated = validateTrip(points, startTs, endTs)
    if (!validated) {
      Alert.alert('Viaggio scartato', 'Il viaggio era troppo breve (< 500m o < 1 min).')
      return
    }

    const avgSpeed = points.length > 0 ? points.reduce((sum, point) => sum + point.speedKmh, 0) / points.length : 0
    const maxBrakingG = computeMaxBrakingG(points)

    await saveTrip({
      user_id: user.id,
      vehicle_id: activeVehicle.id,
      start_time: new Date(startTs).toISOString(),
      end_time: new Date(endTs).toISOString(),
      distance_km: validated.distanceKm,
      duration_minutes: validated.durationMinutes,
      avg_speed_kmh: Math.round(avgSpeed * 10) / 10,
      max_speed_kmh: Math.round(maxSpeed * 10) / 10,
      max_lean_angle_deg: leanSummary.maxLeanAngleDeg || null,
      max_lean_left_deg: leanSummary.maxLeanLeftDeg || null,
      max_lean_right_deg: leanSummary.maxLeanRightDeg || null,
      max_braking_g: maxBrakingG,
      route_json: JSON.stringify(points),
    })
    Alert.alert('Viaggio salvato', `${validated.distanceKm.toFixed(1)} km`)
  }

  function handleDeleteTrip(id: string) {
    Alert.alert('Elimina viaggio', 'Sei sicuro?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => deleteTrip(id) },
    ])
  }

  async function syncLeanStatus() {
    const [available, calibrated] = await Promise.all([
      isLeanAngleAvailable(),
      hasLeanAngleCalibration(),
    ])
    setLeanAvailable(available)
    setLeanCalibrated(calibrated)
  }

  async function handleCalibrateLeanAngle() {
    if (isCalibratingLean) {
      return
    }

    const available = await isLeanAngleAvailable()
    setLeanAvailable(available)

    if (!available) {
      Alert.alert(
        'Sensore non disponibile',
        'Questa build non espone correttamente l’accelerometro. Se hai appena aggiunto i sensori, rigenera la development build prima di riprovare.',
      )
      return
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Calibrazione angolo di piega',
        'Fissa il telefono in verticale, moto ferma, e tienilo immobile per circa 2 secondi.',
        [
          { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Calibra', onPress: () => resolve(true) },
        ],
      )
    })

    if (!confirmed) {
      return
    }

    try {
      setIsCalibratingLean(true)
      await calibrateLeanAngle(1800)
      setLeanCalibrated(true)
      Alert.alert('Calibrazione completata', 'Ora puoi avviare il viaggio e salvare anche i dati di piega.')
    } catch (error) {
      console.error('[trips] calibrate lean angle:', error)
      Alert.alert(
        'Calibrazione non riuscita',
        'Non sono riuscito a leggere campioni validi dall’accelerometro. Controlla la development build e riprova con il telefono fermo e verticale.',
      )
    } finally {
      setIsCalibratingLean(false)
    }
  }

  if (screen === 'recording') {
    const polyCoords = points.map((point) => ({ latitude: point.lat, longitude: point.lng }))
    const distKm = points.length > 1
      ? points.reduce((acc, point, index) => index === 0 ? 0 : acc + simpleDistKm(points[index - 1], point), 0)
      : 0

    return (
      <AppScreen padded={false}>
        <View style={styles.liveHeader}>
          <StatusPill label="REC" tone="danger" />
          <Text style={styles.liveTimer}>{formatElapsed(elapsed)}</Text>
          <ActionButton label="Stop" variant="danger" compact onPress={() => { void handleStop() }} />
        </View>
        {canRenderNativeMap ? (
          <MapView
            ref={mapRef}
            style={{ width, height: mapHeight }}
            provider={PROVIDER_DEFAULT}
            initialRegion={{ latitude: 41.9, longitude: 12.5, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
            showsUserLocation
            followsUserLocation
          >
            {polyCoords.length > 1 ? <Polyline coordinates={polyCoords} strokeColor={colors.primary} strokeWidth={4} /> : null}
          </MapView>
        ) : (
          <MapFallback height={mapHeight} />
        )}
        <View style={styles.liveStats}>
          <StatCell value={`${distKm.toFixed(1)} km`} label="distanza" />
          <StatCell value={`${currentSpeed} km/h`} label="velocita" />
          <StatCell value={`${Math.round(maxSpeed)} km/h`} label="max" />
          <StatCell value={currentLeanAngle != null ? `${Math.abs(currentLeanAngle).toFixed(0)}°` : '--'} label="piega" />
        </View>
        <Text style={styles.limitText}>
          Valido solo con telefono montato verticalmente sul manubrio. Errore stimato: ±5-10 gradi.
        </Text>
      </AppScreen>
    )
  }

  if (screen === 'detail' && selectedTrip) {
    const trip = trips.find((item) => item.id === selectedTrip)
    if (!trip) {
      setScreen('list')
      return null
    }
    const routePoints: RoutePoint[] = JSON.parse(trip.route_json)
    const polyCoords = routePoints.map((point) => ({ latitude: point.lat, longitude: point.lng }))
    const center = routePoints[Math.floor(routePoints.length / 2)]

    return (
      <AppScreen padded={false}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setScreen('list')}>
            <Text style={styles.backText}>‹ Indietro</Text>
          </TouchableOpacity>
          <Text style={styles.detailTitle}>{formatDate(trip.start_time.slice(0, 10))}</Text>
          <View style={{ width: 56 }} />
        </View>
        {canRenderNativeMap ? (
          <MapView
            style={{ width, height: mapHeight }}
            provider={PROVIDER_DEFAULT}
            initialRegion={center
              ? { latitude: center.lat, longitude: center.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
              : { latitude: 41.9, longitude: 12.5, latitudeDelta: 0.1, longitudeDelta: 0.1 }}
          >
            {polyCoords.length > 1 ? <Polyline coordinates={polyCoords} strokeColor={colors.primary} strokeWidth={4} /> : null}
          </MapView>
        ) : (
          <MapFallback height={mapHeight} />
        )}
        <AppScreen>
          <Panel title="Dati viaggio" subtitle="Distanza, durata e velocita del percorso registrato." tone="info">
            <View style={styles.tripStatsRow}>
              <StatCell value={`${trip.distance_km.toFixed(1)} km`} label="distanza" />
              <StatCell value={`${trip.duration_minutes} min`} label="durata" />
              <StatCell value={`${trip.avg_speed_kmh.toFixed(1)} km/h`} label="media" />
              <StatCell value={`${trip.max_speed_kmh.toFixed(1)} km/h`} label="max" />
            </View>
          </Panel>
          <Panel title="Dinamica sensori" subtitle="Dati indicativi ricavati da sensori e velocita del telefono." tone="warning">
            <View style={styles.tripStatsRow}>
              <StatCell value={trip.max_lean_angle_deg != null ? `${trip.max_lean_angle_deg.toFixed(0)}°` : '--'} label="massima" />
              <StatCell value={trip.max_lean_left_deg != null ? `${trip.max_lean_left_deg.toFixed(0)}°` : '--'} label="sinistra" />
              <StatCell value={trip.max_lean_right_deg != null ? `${trip.max_lean_right_deg.toFixed(0)}°` : '--'} label="destra" />
              <StatCell value={trip.max_braking_g != null ? `${trip.max_braking_g.toFixed(2)} g` : '--'} label="frenata" />
            </View>
            <Text style={styles.noteText}>
              Piega valida solo con telefono montato verticalmente sul manubrio. Frenata massima stimata da variazione velocita: valore indicativo.
            </Text>
          </Panel>
        </AppScreen>
      </AppScreen>
    )
  }

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Trips"
        title="Viaggi"
        subtitle="Storico percorsi, tracking manuale e stato dell’avvio automatico."
      />

      {!activeVehicle ? (
        <Panel title="Veicolo richiesto" subtitle="Seleziona prima una moto dal Garage per registrare un viaggio.">
          <Text style={styles.centerIcon}>🗺️</Text>
        </Panel>
      ) : (
        <>
          {designPreset === 'glass' ? (
            <Panel
              tone="hero"
              title={`${activeVehicle.brand} ${activeVehicle.model}`}
              subtitle={autoTripEnabled ? 'Auto tracking abilitato. I viaggi manuali restano disponibili per la piega.' : 'Tracking manuale pronto per percorsi e telemetria leggera.'}
            >
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryValue}>{trips.length}</Text>
                  <Text style={styles.summaryLabel}>viaggi</Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryValue}>{leanCalibrated ? 'OK' : 'NO'}</Text>
                  <Text style={styles.summaryLabel}>piega calibrata</Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryValue}>{autoTripRecording ? 'REC' : 'IDLE'}</Text>
                  <Text style={styles.summaryLabel}>auto trip</Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryValue}>
                    {trips[0]?.max_lean_angle_deg != null ? `${trips[0].max_lean_angle_deg.toFixed(0)}°` : '--'}
                  </Text>
                  <Text style={styles.summaryLabel}>ultima piega max</Text>
                </View>
              </View>
            </Panel>
          ) : null}

          <Panel title="Mappa e tracking" subtitle="La mappa appare durante una registrazione oppure aprendo un viaggio salvato.">
            {autoTripEnabled ? (
              <>
                <View style={styles.autoRow}>
                  <StatusPill label={autoTripRecording ? 'Registrazione in corso' : 'In attesa di movimento'} tone={autoTripRecording ? 'warning' : 'success'} />
                </View>
                <Text style={styles.noteText}>Lo schermo puo spegnersi normalmente. GarageMoto continua a osservare il movimento finche il sistema non chiude l’app.</Text>
                {autoTripRecording ? (
                  <ActionButton
                    label="Ferma e salva viaggio automatico"
                    variant="danger"
                    onPress={() => {
                      void stopCurrentTrip().then(async () => {
                        if (activeVehicle?.id) {
                          await loadTrips(activeVehicle.id)
                        }
                      })
                    }}
                  />
                ) : null}
              </>
            ) : (
              <ActionButton label="Inizia viaggio" onPress={() => { void handleStart() }} />
            )}
            <Text style={styles.noteText}>
              Per l'angolo di piega il telefono deve essere montato verticalmente sul manubrio e calibrato prima del primo uso.
            </Text>
          </Panel>

          <Panel
            title="Angolo di piega"
            subtitle="Funzione indicativa basata sull’accelerometro del telefono. Richiede calibrazione esplicita."
            tone={leanAvailable === false ? 'danger' : leanCalibrated ? 'info' : 'warning'}
          >
            <View style={styles.leanStatusRow}>
              <StatusPill
                label={
                  leanAvailable === false
                    ? 'Sensore non disponibile'
                    : leanCalibrated
                      ? 'Calibrato'
                      : 'Da calibrare'
                }
                tone={
                  leanAvailable === false
                    ? 'danger'
                    : leanCalibrated
                      ? 'success'
                      : 'warning'
                }
              />
              <Text style={styles.leanStatusText}>
                {leanAvailable === false
                  ? 'Se il sensore manca in questa build, rigenera la development build prima di riprovare.'
                  : leanCalibrated
                    ? 'I prossimi viaggi manuali salveranno l’angolo massimo di piega.'
                    : 'Calibra una volta con telefono verticale e moto ferma.'}
              </Text>
            </View>
            <ActionButton
              label={leanCalibrated ? 'Ricalibra sensore piega' : 'Calibra sensore piega'}
              variant="secondary"
              loading={isCalibratingLean}
              onPress={() => { void handleCalibrateLeanAngle() }}
            />
          </Panel>

          {trips.length === 0 ? (
            <Panel title="Nessun viaggio registrato" subtitle="Tocca il pulsante principale per creare il primo percorso.">
              <Text style={styles.centerIcon}>🛣️</Text>
            </Panel>
          ) : (
            trips.map((trip) => (
              <TouchableOpacity key={trip.id} onPress={() => { setSelectedTrip(trip.id); setScreen('detail') }}>
                <Panel
                  title={formatDate(trip.start_time.slice(0, 10))}
                  subtitle={`${trip.distance_km.toFixed(1)} km · ${trip.duration_minutes} min · ${trip.avg_speed_kmh.toFixed(0)} km/h medi`}
                >
                  <View style={styles.tripFooter}>
                    <View style={styles.tripPills}>
                      <StatusPill label={`${trip.max_speed_kmh.toFixed(0)} km/h max`} tone="info" />
                      <StatusPill
                        label={trip.max_lean_angle_deg != null ? `${trip.max_lean_angle_deg.toFixed(0)}° piega` : 'piega --'}
                        tone={trip.max_lean_angle_deg != null ? 'warning' : 'default'}
                      />
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteTrip(trip.id)}>
                      <Text style={styles.deleteText}>Elimina</Text>
                    </TouchableOpacity>
                  </View>
                </Panel>
              </TouchableOpacity>
            ))
          )}
        </>
      )}
    </AppScreen>
  )
}

function StatCell({ value, label }: { value: string; label: string }) {
  const styles = createStyles(useTheme())
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function MapFallback({ height }: { height: number }) {
  const styles = createStyles(useTheme())

  return (
    <View style={[styles.mapFallback, { height }]}>
      <Text style={styles.mapFallbackIcon}>🗺️</Text>
      <Text style={styles.mapFallbackTitle}>Mappa disattivata su Android</Text>
      <Text style={styles.mapFallbackText}>
        Il viaggio continua a registrare percorso e statistiche. La mappa nativa Google richiede una API key dedicata; con il vincolo
        di provider gratuiti questa build mostra solo il riepilogo testuale.
      </Text>
    </View>
  )
}

function confirmTrackingStart(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert('Avvia registrazione GPS', 'GarageMoto usera il GPS durante il viaggio. Lo schermo puo spegnersi normalmente.', [
      { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continua', onPress: () => resolve(true) },
    ])
  })
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const sec = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function simpleDistKm(a: RoutePoint, b: RoutePoint): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  const { colors, font, radius, spacing } = theme

  return StyleSheet.create({
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: 52,
    paddingBottom: spacing.md,
    backgroundColor: colors.bgDark,
  },
  liveTimer: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: font.xl,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  liveStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.bgDark,
  },
  mapFallback: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surfaceDk,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  mapFallbackIcon: {
    fontSize: 38,
    marginBottom: spacing.sm,
  },
  mapFallbackTitle: {
    color: colors.textPrimary,
    fontSize: font.lg,
    fontWeight: '800',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  mapFallbackText: {
    color: colors.textSecondary,
    fontSize: font.sm,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  limitText: {
    color: colors.textSecondary,
    fontSize: font.sm,
    lineHeight: 18,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.bgDark,
  },
  statCell: {
    flex: 1,
    backgroundColor: colors.surfaceDk,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: font.lg,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: font.sm,
    marginTop: 4,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 52,
    paddingBottom: spacing.md,
    backgroundColor: colors.bgDark,
  },
  backText: {
    color: colors.accentSoft,
    fontSize: font.base,
    fontWeight: '700',
  },
  detailTitle: {
    color: colors.textPrimary,
    fontSize: font.base,
    fontWeight: '700',
  },
  centerIcon: {
    fontSize: 52,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryCell: {
    flex: 1,
    minWidth: '47%',
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  summaryValue: {
    color: colors.textPrimary,
    fontSize: font.xl,
    fontWeight: '800',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: font.sm,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  autoRow: {
    marginBottom: spacing.sm,
  },
  noteText: {
    color: colors.textSecondary,
    fontSize: font.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  tripFooter: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tripPills: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  deleteText: {
    color: colors.error,
    fontSize: font.sm,
    fontWeight: '700',
  },
  tripStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  leanStatusRow: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  leanStatusText: {
    color: colors.textSecondary,
    fontSize: font.sm,
    lineHeight: 19,
  },
  })
}
