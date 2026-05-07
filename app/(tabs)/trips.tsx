// R1.1
import { useEffect, useRef, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, StyleSheet, ActivityIndicator, useWindowDimensions,
} from 'react-native'
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps'
import { useAuthStore } from '../../src/store/authStore'
import { useAutoTripStore } from '../../src/store/autoTripStore'
import { useVehicleStore } from '../../src/store/vehicleStore'
import { useTripStore } from '../../src/store/tripStore'
import {
  requestLocationPermission,
  startTracking,
  stopTracking,
  validateTrip,
} from '../../src/services/location'
import { formatDate } from '../../src/utils/formatters'
import { colors, spacing, radius, font } from '../../src/theme'
import type { RoutePoint } from '../../src/types/trip'

type Screen = 'list' | 'recording' | 'detail'

export default function TripsScreen() {
  const { user } = useAuthStore()
  const {
    enabled: autoTripEnabled,
    isRecording: autoTripRecording,
    stopCurrentTrip,
  } = useAutoTripStore()
  const { activeVehicle } = useVehicleStore()
  const { trips, loadTrips, saveTrip, deleteTrip } = useTripStore()

  const [screen, setScreen]         = useState<Screen>('list')
  const [points, setPoints]         = useState<RoutePoint[]>([])
  const [startTs, setStartTs]       = useState(0)
  const [elapsed, setElapsed]       = useState(0)
  const [currentSpeed, setSpeed]    = useState(0)
  const [maxSpeed, setMaxSpeed]     = useState(0)
  const [selectedTrip, setSelected] = useState<string | null>(null)

  const mapRef      = useRef<MapView>(null)
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const { width }   = useWindowDimensions()
  const mapH        = Math.round(width * 0.6)

  useEffect(() => {
    if (activeVehicle?.id) loadTrips(activeVehicle.id)
  }, [activeVehicle?.id])

  // Timer contatore durante registrazione
  useEffect(() => {
    if (screen === 'recording') {
      timerRef.current = setInterval(
        () => setElapsed(Math.floor((Date.now() - startTs) / 1000)),
        1000,
      )
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
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
      const ts = Date.now()
      setStartTs(ts)
      setPoints([])
      setSpeed(0)
      setMaxSpeed(0)
      setElapsed(0)
      setScreen('recording')

      await startTracking((point) => {
        setPoints(prev => {
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
        setMaxSpeed(prev => Math.max(prev, point.speedKmh))
      })
    } catch (error) {
      console.error('[trips] startTracking:', error)
      stopTracking()
      setScreen('list')
      Alert.alert('Errore GPS', 'Impossibile avviare la registrazione del viaggio.')
    }
  }

  async function handleStop() {
    stopTracking()
    const endTs = Date.now()
    setScreen('list')

    if (!user?.id || !activeVehicle?.id) return

    const validated = validateTrip(points, startTs, endTs)
    if (!validated) {
      Alert.alert('Viaggio scartato', 'Il viaggio era troppo breve (< 500m o < 1 min).')
      return
    }

    const avgSpeed = points.length > 0
      ? points.reduce((s, p) => s + p.speedKmh, 0) / points.length
      : 0

    await saveTrip({
      user_id:          user.id,
      vehicle_id:       activeVehicle.id,
      start_time:       new Date(startTs).toISOString(),
      end_time:         new Date(endTs).toISOString(),
      distance_km:      validated.distanceKm,
      duration_minutes: validated.durationMinutes,
      avg_speed_kmh:    Math.round(avgSpeed * 10) / 10,
      max_speed_kmh:    Math.round(maxSpeed * 10) / 10,
      route_json:       JSON.stringify(points),
    })
    Alert.alert('✅ Viaggio salvato!', `${validated.distanceKm.toFixed(1)} km`)
  }

  function handleDeleteTrip(id: string) {
    Alert.alert('Elimina viaggio', 'Sei sicuro?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => deleteTrip(id) },
    ])
  }

  // ── Schermata registrazione ──────────────────────────────────────────────
  if (screen === 'recording') {
    const polyCoords = points.map(p => ({ latitude: p.lat, longitude: p.lng }))
    const distKm = points.length > 1
      ? (points.reduce((acc, p, i) => {
          if (i === 0) return 0
          return acc + _simpleDistKm(points[i - 1], p)
        }, 0))
      : 0

    return (
      <View style={s.root}>
        {/* Header REC */}
        <View style={s.recHeader}>
          <View style={s.recDot} />
          <Text style={s.recTime}>{_fmtElapsed(elapsed)}</Text>
          <TouchableOpacity style={s.stopBtn} onPress={handleStop}>
            <Text style={s.stopBtnText}>STOP</Text>
          </TouchableOpacity>
        </View>

        {/* Mappa live */}
        <MapView
          ref={mapRef}
          style={{ width, height: mapH }}
          provider={PROVIDER_DEFAULT}
          initialRegion={{ latitude: 41.9, longitude: 12.5, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
          showsUserLocation
          followsUserLocation
        >
          {polyCoords.length > 1 && (
            <Polyline coordinates={polyCoords} strokeColor={colors.primary} strokeWidth={4} />
          )}
        </MapView>

        {/* Stats live */}
        <View style={s.statsBar}>
          <StatCell value={`${distKm.toFixed(1)} km`} label="distanza" />
          <StatCell value={`${currentSpeed} km/h`} label="velocità" />
          <StatCell value={`${Math.round(maxSpeed)} km/h`} label="max" />
        </View>
      </View>
    )
  }

  // ── Dettaglio viaggio ────────────────────────────────────────────────────
  if (screen === 'detail' && selectedTrip) {
    const trip = trips.find(t => t.id === selectedTrip)
    if (!trip) { setScreen('list'); return null }

    const routePoints: RoutePoint[] = JSON.parse(trip.route_json)
    const polyCoords = routePoints.map(p => ({ latitude: p.lat, longitude: p.lng }))
    const center = routePoints[Math.floor(routePoints.length / 2)]

    return (
      <View style={s.root}>
        <View style={[s.recHeader, { backgroundColor: colors.surfaceDk }]}>
          <TouchableOpacity onPress={() => setScreen('list')}>
            <Text style={{ color: colors.primary, fontSize: font.base }}>‹ Indietro</Text>
          </TouchableOpacity>
          <Text style={s.detailTitle}>{formatDate(trip.start_time.slice(0, 10))}</Text>
        </View>

        <MapView
          style={{ width, height: mapH }}
          provider={PROVIDER_DEFAULT}
          initialRegion={center
            ? { latitude: center.lat, longitude: center.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
            : { latitude: 41.9, longitude: 12.5, latitudeDelta: 0.1, longitudeDelta: 0.1 }
          }
        >
          {polyCoords.length > 1 && (
            <Polyline coordinates={polyCoords} strokeColor={colors.primary} strokeWidth={4} />
          )}
        </MapView>

        <ScrollView style={{ flex: 1, backgroundColor: colors.bgDark }} contentContainerStyle={{ padding: spacing.md }}>
          <View style={s.statsBar}>
            <StatCell value={`${trip.distance_km.toFixed(1)} km`} label="distanza" />
            <StatCell value={`${trip.duration_minutes} min`} label="durata" />
            <StatCell value={`${trip.avg_speed_kmh.toFixed(1)}`} label="km/h medi" />
            <StatCell value={`${trip.max_speed_kmh.toFixed(1)}`} label="km/h max" />
          </View>
        </ScrollView>
      </View>
    )
  }

  // ── Lista viaggi ─────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.header}>
          <Text style={s.title}>Viaggi</Text>
        </View>

        <View style={s.infoCard}>
          <Text style={s.infoTitle}>Come funziona questa schermata</Text>
          <Text style={s.infoText}>
            Qui vedi lo storico dei viaggi. La mappa compare durante la registrazione oppure aprendo un viaggio salvato.
          </Text>
        </View>

        {!activeVehicle && (
          <Text style={s.noVehicle}>Seleziona prima un veicolo dal Garage.</Text>
        )}

        {trips.length === 0 && activeVehicle && (
          <View style={s.center}>
            <Text style={{ fontSize: 48, marginBottom: spacing.md }}>🗺️</Text>
            <Text style={s.emptyTitle}>Nessun viaggio</Text>
            <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
              Tocca il pulsante arancio per registrare il primo percorso.
            </Text>
          </View>
        )}

        {autoTripEnabled && (
          <View style={s.autoCard}>
            <Text style={s.autoTitle}>Rilevamento automatico attivo</Text>
            <Text style={s.autoText}>
              GarageMoto avvia un viaggio quando rileva movimento. Lo schermo puo spegnersi normalmente.
            </Text>
            <Text style={s.autoText}>
              Stato attuale: {autoTripRecording ? 'registrazione in corso' : 'in attesa di movimento'}
            </Text>
            {autoTripRecording && (
              <TouchableOpacity
                style={s.inlineStopBtn}
                onPress={async () => {
                  await stopCurrentTrip()
                  if (activeVehicle?.id) {
                    await loadTrips(activeVehicle.id)
                  }
                }}
              >
                <Text style={s.inlineStopText}>Ferma e salva viaggio</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {trips.map(t => (
          <TouchableOpacity
            key={t.id}
            style={s.tripCard}
            onPress={() => { setSelected(t.id); setScreen('detail') }}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.tripDate}>{formatDate(t.start_time.slice(0, 10))}</Text>
              <Text style={s.tripStats}>
                {t.distance_km.toFixed(1)} km · {t.duration_minutes} min · {t.avg_speed_kmh.toFixed(0)} km/h med
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleDeleteTrip(t.id)}>
              <Text style={{ color: colors.error, fontSize: 18 }}>🗑</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* FAB avvia viaggio */}
      {activeVehicle && !autoTripEnabled && (
        <TouchableOpacity style={s.fab} onPress={handleStart}>
          <Text style={s.fabText}>▶ Inizia viaggio</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: colors.textPrimary, fontWeight: 'bold', fontSize: font.lg }}>{value}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: font.sm }}>{label}</Text>
    </View>
  )
}

function confirmTrackingStart(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Avvia registrazione GPS',
      'GarageMoto usera il GPS durante il viaggio. Lo schermo puo spegnersi normalmente.',
      [
        { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continua', onPress: () => resolve(true) },
      ],
    )
  })
}

function _fmtElapsed(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function _simpleDistKm(a: RoutePoint, b: RoutePoint): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.bgDark },
  content:    { padding: spacing.md, paddingTop: 56, paddingBottom: 100 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  title:      { fontSize: font.xxl, fontWeight: 'bold', color: colors.textPrimary },
  noVehicle:  { color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.xl },
  center:     { alignItems: 'center', paddingVertical: spacing.xl },
  emptyTitle: { fontSize: font.lg, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  infoCard:   { backgroundColor: colors.surfaceDk, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  infoTitle:  { color: colors.primary, fontSize: font.base, fontWeight: '600', marginBottom: spacing.xs },
  infoText:   { color: colors.textSecondary, fontSize: font.sm, lineHeight: 18 },
  tripCard:   { backgroundColor: colors.surfaceDk, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center' },
  tripDate:   { fontSize: font.base, fontWeight: '600', color: colors.textPrimary },
  tripStats:  { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  autoCard:   { backgroundColor: colors.surfaceDk, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  autoTitle:  { color: colors.primary, fontSize: font.base, fontWeight: '600', marginBottom: spacing.sm },
  autoText:   { color: colors.textSecondary, fontSize: font.sm, lineHeight: 18 },
  inlineStopBtn: { marginTop: spacing.md, alignSelf: 'flex-start', backgroundColor: colors.error, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  inlineStopText: { color: '#fff', fontWeight: '600', fontSize: font.sm },
  fab:        { position: 'absolute', bottom: spacing.xl, left: spacing.lg, right: spacing.lg, backgroundColor: colors.primary, borderRadius: radius.xl, paddingVertical: 16, alignItems: 'center' },
  fabText:    { color: '#fff', fontWeight: 'bold', fontSize: font.lg },
  recHeader:  { flexDirection: 'row', alignItems: 'center', padding: spacing.md, paddingTop: 52, backgroundColor: colors.bgDark },
  recDot:     { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.error, marginRight: spacing.sm },
  recTime:    { flex: 1, fontSize: font.xl, fontWeight: 'bold', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  stopBtn:    { backgroundColor: colors.error, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  stopBtnText:{ color: '#fff', fontWeight: 'bold', fontSize: font.base },
  statsBar:   { flexDirection: 'row', backgroundColor: colors.surfaceDk, padding: spacing.md },
  detailTitle:{ fontSize: font.base, fontWeight: '600', color: colors.textPrimary, flex: 1, textAlign: 'center' },
})
