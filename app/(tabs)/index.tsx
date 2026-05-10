import { useCallback, useEffect, useMemo, useState } from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import type { Href } from 'expo-router'
import { ActionButton } from '../../src/components/ui/ActionButton'
import { AppScreen } from '../../src/components/ui/AppScreen'
import { MetricTile } from '../../src/components/ui/MetricTile'
import { Panel } from '../../src/components/ui/Panel'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { StatusPill } from '../../src/components/ui/StatusPill'
import { useAuthStore } from '../../src/store/authStore'
import { useMaintenanceStore } from '../../src/store/maintenanceStore'
import { useRefuelStore } from '../../src/store/refuelStore'
import { useTripStore } from '../../src/store/tripStore'
import { useVehicleStore } from '../../src/store/vehicleStore'
import { getVehicleImageUri } from '../../src/services/vehicleImageStore'
import { useTheme } from '../../src/useTheme'
import { MAINTENANCE_LABELS, type Maintenance } from '../../src/types/maintenance'
import type { Refuel } from '../../src/types/refuel'
import type { Trip } from '../../src/types/trip'
import type { Vehicle } from '../../src/types/vehicle'
import { averageConsumption, currentMonthSpending, estimatedRange } from '../../src/utils/fuelCalculator'
import { formatDate, formatEuro } from '../../src/utils/formatters'
import { getStatus } from '../../src/utils/maintenanceChecker'

const PERFORMANCE_ROUTE = '/performance' as Href
type GlassViewMode = 'overview' | 'costs' | 'rides'

export default function DashboardScreen() {
  const theme = useTheme()
  const styles = createStyles(theme)
  const glassStyles = createGlassStyles(theme)
  const { colors, designPreset } = theme
  const { user } = useAuthStore()
  const { activeVehicle, loadVehicles } = useVehicleStore()
  const { refuels, loadRefuels } = useRefuelStore()
  const { items: maintenance, loadMaintenance } = useMaintenanceStore()
  const { trips, loadTrips } = useTripStore()
  const [viewMode, setViewMode] = useState<GlassViewMode>('overview')
  const [vehicleImageUri, setVehicleImageUri] = useState<string | null>(null)

  const loadVehicleImage = useCallback(async () => {
    if (!activeVehicle?.id) {
      setVehicleImageUri(null)
      return
    }

    try {
      const uri = await getVehicleImageUri(activeVehicle.id)
      setVehicleImageUri(uri)
    } catch (error) {
      console.error('[dashboard] vehicle image:', error)
      setVehicleImageUri(null)
    }
  }, [activeVehicle?.id])

  useEffect(() => {
    if (user?.id) {
      void loadVehicles(user.id)
    }
  }, [loadVehicles, user?.id])

  useEffect(() => {
    if (!activeVehicle?.id) {
      return
    }
    void loadRefuels(activeVehicle.id)
    void loadMaintenance(activeVehicle.id)
    void loadTrips(activeVehicle.id)
  }, [activeVehicle?.id, loadMaintenance, loadRefuels, loadTrips])

  useEffect(() => {
    void loadVehicleImage()
  }, [loadVehicleImage])

  useFocusEffect(
    useCallback(() => {
      void loadVehicleImage()
    }, [loadVehicleImage]),
  )

  if (!activeVehicle) {
    return (
      <AppScreen>
        <ScreenHeader
          eyebrow="GarageMoto"
          title="Nessuna moto attiva"
          subtitle="Aggiungi il tuo veicolo per trasformare l’app nel tuo cruscotto personale."
        />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>🏍️</Text>
          <Text style={styles.emptyTitle}>Il garage e ancora vuoto</Text>
          <Text style={styles.emptyText}>Parti dal profilo veicolo, poi consumi, viaggi e manutenzione prenderanno forma.</Text>
          <ActionButton label="Vai al garage" onPress={() => router.push('/garage')} />
        </View>
      </AppScreen>
    )
  }

  const currentKm = refuels[0]?.odometer_km ?? activeVehicle.odometer_start_km
  const avg = averageConsumption(refuels)
  const lastKml = refuels[0]?.km_per_liter ?? null
  const range = estimatedRange(activeVehicle.tank_capacity_l, refuels, currentKm)
  const monthSpend = currentMonthSpending(refuels)
  const lastRefuel = refuels[0]
  const lastTrip = trips[0]
  const overdue = maintenance.filter((item) => getStatus(item, currentKm) === 'overdue')
  const warning = maintenance.filter((item) => getStatus(item, currentKm) === 'warning')
  const isOverdue = overdue.length > 0

  if (designPreset === 'glass') {
    return (
      <GlassDashboard
        theme={theme}
        activeVehicle={activeVehicle}
        avg={avg}
        currentKm={currentKm}
        isOverdue={isOverdue}
        lastKml={lastKml}
        lastRefuel={lastRefuel}
        lastTrip={lastTrip}
        maintenance={maintenance}
        monthSpend={monthSpend}
        overdue={overdue}
        range={range}
        refuels={refuels}
        trips={trips}
        vehicleImageUri={vehicleImageUri}
        viewMode={viewMode}
        warning={warning}
        onChangeMode={setViewMode}
      />
    )
  }

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Cruscotto"
        title={activeVehicle.nickname ?? `${activeVehicle.brand} ${activeVehicle.model}`}
        subtitle="Quadro strumenti, viaggi recenti e stato manutenzione in una vista unica."
      />

      <Panel
        tone="hero"
        title="Moto attiva"
        subtitle={`${activeVehicle.brand} ${activeVehicle.model} · ${activeVehicle.year} · ${activeVehicle.tank_capacity_l.toFixed(1)} L`}
      >
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.heroLabel}>Odometro corrente</Text>
            <Text style={styles.heroValue}>{currentKm.toLocaleString('it-IT')} km</Text>
          </View>
          <StatusPill
            label={isOverdue ? 'Service urgente' : warning.length > 0 ? 'Service vicino' : 'Moto in ordine'}
            tone={isOverdue ? 'danger' : warning.length > 0 ? 'warning' : 'success'}
          />
        </View>
      </Panel>

      {(overdue.length > 0 || warning.length > 0) && (
        <TouchableOpacity
          style={[styles.alertBanner, { borderColor: isOverdue ? colors.error : colors.warning }]}
          onPress={() => router.push('/maintenance')}
        >
          <Text style={styles.alertIcon}>{isOverdue ? '🔴' : '🟠'}</Text>
          <Text style={[styles.alertText, { color: isOverdue ? colors.error : colors.warning }]}>
            {isOverdue
              ? `${overdue.length} manutenzioni scadute`
              : `${warning.length} manutenzioni in scadenza`}
          </Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      )}

      <View style={styles.metricGrid}>
        <MetricTile label="Ultimo km/l" value={lastKml != null ? lastKml.toFixed(1) : '--'} tone="accent" />
        <MetricTile label="Media km/l" value={avg != null ? avg.toFixed(1) : '--'} />
        <MetricTile label="Autonomia" value={range != null ? `${Math.round(range)} km` : '--'} tone="info" />
        <MetricTile label="Spesa mese" value={formatEuro(monthSpend)} tone="warning" />
      </View>

      {lastRefuel && (
        <Panel title="Ultimo rifornimento" subtitle={formatDate(lastRefuel.date)}>
          <View style={styles.statRow}>
            <Stat value={`${lastRefuel.liters.toFixed(2)} L`} label="litri" />
            <Stat value={formatEuro(lastRefuel.amount_eur)} label="importo" />
            <Stat value={lastRefuel.km_per_liter != null ? `${lastRefuel.km_per_liter.toFixed(1)} km/l` : '--'} label="consumo" />
          </View>
        </Panel>
      )}

      {lastTrip && (
        <TouchableOpacity onPress={() => router.push('./trips')}>
          <Panel title="Ultimo viaggio" subtitle={formatDate(lastTrip.start_time.slice(0, 10))} tone="info">
            <View style={styles.statRow}>
              <Stat value={`${lastTrip.distance_km.toFixed(1)} km`} label="distanza" />
              <Stat value={`${lastTrip.duration_minutes} min`} label="durata" />
              <Stat value={`${lastTrip.avg_speed_kmh.toFixed(0)} km/h`} label="media" />
            </View>
          </Panel>
        </TouchableOpacity>
      )}

      <View style={styles.actionStack}>
        <ActionButton label="Vedi statistiche complete" variant="secondary" onPress={() => router.push('/statistics')} />
        <ActionButton label="Apri performance bonus" variant="warning" onPress={() => router.push(PERFORMANCE_ROUTE)} />
      </View>
    </AppScreen>
  )
}

function GlassDashboard({
  theme,
  activeVehicle,
  avg,
  currentKm,
  isOverdue,
  lastKml,
  lastRefuel,
  lastTrip,
  maintenance,
  monthSpend,
  overdue,
  range,
  refuels,
  trips,
  vehicleImageUri,
  viewMode,
  warning,
  onChangeMode,
}: {
  theme: ReturnType<typeof useTheme>
  activeVehicle: Vehicle
  avg: number | null
  currentKm: number
  isOverdue: boolean
  lastKml: number | null
  lastRefuel: Refuel | undefined
  lastTrip: Trip | undefined
  maintenance: Maintenance[]
  monthSpend: number
  overdue: Maintenance[]
  range: number | null
  refuels: Refuel[]
  trips: Trip[]
  vehicleImageUri: string | null
  viewMode: GlassViewMode
  warning: Maintenance[]
  onChangeMode: (mode: GlassViewMode) => void
}) {
  const glassStyles = createGlassStyles(theme)
  const recentTrips = trips.slice(0, 3)
  const monthlyBars = useMemo(() => buildMonthlySpendBars(refuels), [refuels])
  const leanLeaderboard = useMemo(() => buildLeanLeaderboard(trips, theme.colors), [theme.colors, trips])
  const fuelPct = avg && range ? Math.max(0, Math.min(100, Math.round((range / (activeVehicle.tank_capacity_l * avg)) * 100))) : null
  const serviceLabel = isOverdue ? 'Service urgente' : warning.length > 0 ? 'Service vicino' : 'Moto in ordine'
  const topMaintenance = [...overdue, ...warning, ...maintenance.filter((item) => getStatus(item, currentKm) === 'ok')][0]

  return (
    <AppScreen>
      <View style={glassStyles.headerBlock}>
        <Text style={glassStyles.greeting}>Il tuo garage</Text>
        <Text style={glassStyles.vehicleName}>
          <Text style={glassStyles.vehicleAccent}>{activeVehicle.brand}</Text> {activeVehicle.model}
        </Text>
      </View>

      {(overdue.length > 0 || warning.length > 0) && (
        <TouchableOpacity style={glassStyles.alertBanner} onPress={() => router.push('/maintenance')}>
          <View style={glassStyles.alertDot} />
          <Text style={glassStyles.alertBannerText}>
            {isOverdue
              ? `${formatMaintenanceLabel(overdue[0])} scaduto`
              : `${formatMaintenanceLabel(warning[0])} vicino alla scadenza`}
          </Text>
          <Text style={glassStyles.alertArrow}>›</Text>
        </TouchableOpacity>
      )}

      <View style={glassStyles.heroCard}>
        <View style={glassStyles.heroGrid} />
        <View style={glassStyles.heroGlow} />
        <View style={glassStyles.heroBody}>
          <View style={glassStyles.heroCopy}>
            <View style={glassStyles.heroBadge}>
              <Text style={glassStyles.heroBadgeText}>MOTO ATTIVA</Text>
            </View>
            <Text style={glassStyles.heroTitle}>{activeVehicle.nickname ?? `${activeVehicle.brand} ${activeVehicle.model}`}</Text>
            <Text style={glassStyles.heroSubline}>
              {activeVehicle.year} · {currentKm.toLocaleString('it-IT')} km · {activeVehicle.tank_capacity_l.toFixed(1)} L
            </Text>
            <View style={glassStyles.heroStatusRow}>
              <StatusPill label={serviceLabel} tone={isOverdue ? 'danger' : warning.length > 0 ? 'warning' : 'success'} />
              {fuelPct != null ? <Text style={glassStyles.heroStatusText}>Fuel stimato {fuelPct}%</Text> : null}
            </View>
          </View>
          <View style={glassStyles.heroMotoWrap}>
            {vehicleImageUri ? (
              <Image source={{ uri: vehicleImageUri }} style={glassStyles.heroImage} resizeMode="contain" />
            ) : (
              <>
                <Text style={glassStyles.heroMotoEmoji}>🏍️</Text>
                <Text style={glassStyles.heroMotoText}>Usa immagine scontornata</Text>
              </>
            )}
          </View>
        </View>
      </View>

      <View style={glassStyles.kpiGrid}>
        <GlassMetricCard icon="⛽" label="Ultimo km/l" value={lastKml != null ? lastKml.toFixed(1) : '--'} unit="km/l" accent />
        <GlassMetricCard icon="📈" label="Media consumi" value={avg != null ? avg.toFixed(1) : '--'} unit="km/l" />
        <GlassMetricCard icon="🛣️" label="Autonomia" value={range != null ? `${Math.round(range)}` : '--'} unit="km" />
        <GlassMetricCard icon="€" label="Spesa mese" value={String(Math.round(monthSpend))} unit="eur" unitTone="white" />
      </View>

      <View style={glassStyles.viewSwitcher}>
        <GlassToggle label="Panoramica" active={viewMode === 'overview'} onPress={() => onChangeMode('overview')} />
        <GlassToggle label="Costi" active={viewMode === 'costs'} onPress={() => onChangeMode('costs')} />
        <GlassToggle label="Viaggi" active={viewMode === 'rides'} onPress={() => onChangeMode('rides')} />
      </View>

      {viewMode === 'overview' ? (
        <>
          {lastRefuel ? (
            <GlassInfoCard
              title="Ultimo rifornimento"
              meta={formatDate(lastRefuel.date)}
              stats={[
                { value: `${lastRefuel.liters.toFixed(2)} L`, label: 'litri' },
                { value: formatEuro(lastRefuel.amount_eur), label: 'importo' },
                { value: lastRefuel.km_per_liter != null ? `${lastRefuel.km_per_liter.toFixed(1)} km/l` : '--', label: 'consumo' },
              ]}
            />
          ) : null}

          <GlassInfoCard
            title="Assetto e piega"
            meta={lastTrip ? formatDate(lastTrip.start_time.slice(0, 10)) : 'nessun viaggio'}
            stats={[
              { value: lastTrip?.max_lean_angle_deg != null ? `${lastTrip.max_lean_angle_deg.toFixed(0)}°` : '--', label: 'max piega' },
              { value: lastTrip?.max_lean_left_deg != null ? `${lastTrip.max_lean_left_deg.toFixed(0)}°` : '--', label: 'sx' },
              { value: lastTrip?.max_lean_right_deg != null ? `${lastTrip.max_lean_right_deg.toFixed(0)}°` : '--', label: 'dx' },
            ]}
            note="Dato indicativo ricavato dal telefono. Utile per confronto tra uscite, non come telemetria assoluta."
          />

          {topMaintenance ? (
            <GlassInfoCard
              title="Manutenzione"
              meta={serviceLabel}
              stats={[
                { value: formatMaintenanceLabel(topMaintenance), label: 'prossimo item' },
                { value: String(overdue.length), label: 'scaduti' },
                { value: String(warning.length), label: 'warning' },
              ]}
              note="Tocca il banner alert o il tab manutenzione per il dettaglio completo."
            />
          ) : null}
        </>
      ) : null}

      {viewMode === 'costs' ? (
        <>
          <View style={glassStyles.chartCard}>
            <Text style={glassStyles.chartTitle}>Spesa carburante ultimi 6 mesi</Text>
            <View style={glassStyles.barChart}>
              {monthlyBars.map((bar) => (
                <View key={bar.label} style={glassStyles.barCol}>
                  <View style={[glassStyles.bar, { height: `${bar.heightPct}%` }, bar.active ? glassStyles.barActive : glassStyles.barInactive]} />
                  <Text style={glassStyles.barLabel}>{bar.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <GlassInfoCard
            title="Riepilogo costi"
            meta="Analisi rapida"
            stats={[
              { value: formatEuro(monthSpend), label: 'mese corrente' },
              { value: refuels.length > 0 ? formatEuro(refuels.reduce((sum, item) => sum + item.amount_eur, 0)) : formatEuro(0), label: 'totale' },
              { value: avg != null ? `${avg.toFixed(1)} km/l` : '--', label: 'efficienza' },
            ]}
          />
        </>
      ) : null}

      {viewMode === 'rides' ? (
        <>
          <View style={glassStyles.chartCard}>
            <Text style={glassStyles.chartTitle}>Benchmark piega ultimi viaggi</Text>
            <View style={glassStyles.legendWrap}>
              {leanLeaderboard.length > 0 ? leanLeaderboard.map((item) => (
                <View key={item.label} style={glassStyles.legendItem}>
                  <View style={[glassStyles.legendDot, { backgroundColor: item.tone }]} />
                  <Text style={glassStyles.legendLabel}>{item.label}</Text>
                  <Text style={glassStyles.legendValue}>{item.value}</Text>
                </View>
              )) : (
                <Text style={glassStyles.emptyChartText}>Registra un viaggio manuale calibrato per vedere i dati di piega.</Text>
              )}
            </View>
          </View>

          {recentTrips.map((trip) => (
            <TouchableOpacity key={trip.id} onPress={() => router.push('/trips')}>
              <GlassInfoCard
                title="Viaggio"
                meta={formatDate(trip.start_time.slice(0, 10))}
                stats={[
                  { value: `${trip.distance_km.toFixed(1)} km`, label: 'distanza' },
                  { value: `${trip.avg_speed_kmh.toFixed(0)} km/h`, label: 'media' },
                  { value: trip.max_lean_angle_deg != null ? `${trip.max_lean_angle_deg.toFixed(0)}°` : '--', label: 'piega' },
                ]}
              />
            </TouchableOpacity>
          ))}
        </>
      ) : null}

      <View style={glassStyles.actionStack}>
        <ActionButton label="Vedi statistiche complete" variant="secondary" onPress={() => router.push('/statistics')} />
        <ActionButton label="Apri performance bonus" variant="warning" onPress={() => router.push(PERFORMANCE_ROUTE)} />
      </View>
    </AppScreen>
  )
}

function formatMaintenanceLabel(item: Maintenance | undefined): string {
  if (!item) {
    return 'Intervento'
  }

  return item.label?.trim() || MAINTENANCE_LABELS[item.type]
}

function GlassMetricCard({
  accent = false,
  icon,
  label,
  unitTone = 'muted',
  unit,
  value,
}: {
  accent?: boolean
  icon: string
  label: string
  unitTone?: 'muted' | 'white'
  unit: string
  value: string
}) {
  const glassStyles = createGlassStyles(useTheme())
  return (
    <View style={[glassStyles.metricCard, accent && glassStyles.metricCardAccent]}>
      <Text style={glassStyles.metricIcon}>{icon}</Text>
      <Text style={glassStyles.metricLabel}>{label}</Text>
      <Text style={[glassStyles.metricValue, accent && glassStyles.metricValueAccent]}>
        {value}
        <Text style={[glassStyles.metricUnit, unitTone === 'white' && glassStyles.metricUnitWhite]}> {unit}</Text>
      </Text>
    </View>
  )
}

function GlassToggle({
  active,
  label,
  onPress,
}: {
  active: boolean
  label: string
  onPress: () => void
}) {
  const glassStyles = createGlassStyles(useTheme())
  return (
    <TouchableOpacity style={[glassStyles.toggleChip, active && glassStyles.toggleChipActive]} onPress={onPress}>
      <Text style={[glassStyles.toggleChipText, active && glassStyles.toggleChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

function GlassInfoCard({
  meta,
  note,
  stats,
  title,
}: {
  meta: string
  note?: string
  stats: Array<{ value: string; label: string }>
  title: string
}) {
  const glassStyles = createGlassStyles(useTheme())
  return (
    <View style={glassStyles.infoCard}>
      <View style={glassStyles.infoCardHeader}>
        <Text style={glassStyles.infoCardTitle}>{title}</Text>
        <Text style={glassStyles.infoCardDate}>{meta}</Text>
      </View>
      <View style={glassStyles.infoStatsRow}>
        {stats.map((item) => (
          <View key={`${title}-${item.label}`} style={glassStyles.infoStatItem}>
            <Text style={glassStyles.infoStatValue}>{item.value}</Text>
            <Text style={glassStyles.infoStatLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
      {note ? <Text style={glassStyles.infoNote}>{note}</Text> : null}
    </View>
  )
}

function buildMonthlySpendBars(refuels: Refuel[]) {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (5 - index))
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return { key, label: date.toLocaleDateString('it-IT', { month: 'short' }) }
  })

  const values = months.map((month, index) => {
    const total = refuels
      .filter((item) => item.date.startsWith(month.key))
      .reduce((sum, item) => sum + item.amount_eur, 0)
    return {
      label: month.label.replace('.', ''),
      total,
      active: index === months.length - 1,
    }
  })

  const max = Math.max(...values.map((item) => item.total), 1)
  return values.map((item) => ({
    ...item,
    heightPct: Math.max(8, Math.round((item.total / max) * 100)),
  }))
}

function buildLeanLeaderboard(trips: Trip[], colors: ReturnType<typeof useTheme>['colors']) {
  return trips
    .filter((trip) => trip.max_lean_angle_deg != null)
    .slice(0, 4)
    .map((trip, index) => ({
      label: formatDate(trip.start_time.slice(0, 10)),
      value: `${trip.max_lean_angle_deg?.toFixed(0)}°`,
      tone: index === 0 ? colors.primary : index === 1 ? colors.info : colors.textMuted,
    }))
}

function Stat({ value, label }: { value: string; label: string }) {
  const styles = createStyles(useTheme())
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  const { colors, font, radius, spacing } = theme

  return StyleSheet.create({
  emptyWrap: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xxl,
    backgroundColor: colors.surfaceDk,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: font.xl,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: font.base,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    color: colors.textMuted,
    fontSize: font.sm,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroValue: {
    color: colors.textPrimary,
    fontSize: font.xxxl,
    fontWeight: '800',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panelRaised,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  alertIcon: {
    marginRight: spacing.sm,
    fontSize: font.base,
  },
  alertText: {
    flex: 1,
    fontSize: font.sm,
    fontWeight: '700',
  },
  arrow: {
    color: colors.textMuted,
    fontSize: font.lg,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCell: {
    flex: 1,
    backgroundColor: colors.surfaceDk,
    borderRadius: radius.lg,
    padding: spacing.sm + 4,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: font.base,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: font.sm,
    marginTop: 4,
  },
  actionStack: {
    gap: spacing.sm,
  },
  })
}

function createGlassStyles(theme: ReturnType<typeof useTheme>) {
  const { colors, font, radius, spacing } = theme

  return StyleSheet.create({
  headerBlock: {
    marginBottom: spacing.md,
  },
  greeting: {
    color: colors.textMuted,
    fontSize: font.sm,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  vehicleName: {
    color: colors.textPrimary,
    fontSize: font.display,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  vehicleAccent: {
    color: colors.brandFantic,
  },
  alertBanner: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.dangerEdge,
    backgroundColor: colors.dangerSurface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.error,
  },
  alertBannerText: {
    flex: 1,
    color: colors.error,
    fontSize: font.sm,
    fontWeight: '600',
  },
  alertArrow: {
    color: colors.error,
    fontSize: font.lg,
  },
  heroCard: {
    minHeight: 196,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgElevated,
    marginBottom: spacing.md,
  },
  heroGrid: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.5,
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderTopWidth: 1,
  },
  heroGlow: {
    display: 'none',
  },
  heroBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    flex: 1,
  },
  heroCopy: {
    flex: 1,
    justifyContent: 'space-between',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.heroSurface,
    borderWidth: 1,
    borderColor: colors.heroEdge,
    marginBottom: spacing.sm,
  },
  heroBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: font.xxxl,
    fontWeight: '800',
    lineHeight: 34,
    marginBottom: 6,
  },
  heroSubline: {
    color: colors.textSecondary,
    fontSize: font.sm,
    marginBottom: spacing.md,
  },
  heroStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  heroStatusText: {
    color: colors.textSecondary,
    fontSize: font.sm,
  },
  heroMotoWrap: {
    width: 192,
    height: 192,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMotoEmoji: {
    fontSize: 72,
    marginBottom: spacing.sm,
  },
  heroMotoText: {
    color: colors.accentSoft,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.md,
  },
  metricCard: {
    width: '48.5%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceDk,
    overflow: 'hidden',
  },
  metricCardAccent: {
    backgroundColor: colors.heroSurface,
    borderColor: colors.heroEdge,
  },
  metricIcon: {
    fontSize: 18,
    marginBottom: 8,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  metricValueAccent: {
    color: colors.primary,
  },
  metricUnit: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  metricUnitWhite: {
    color: colors.textPrimary,
  },
  viewSwitcher: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  toggleChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceDk,
  },
  toggleChipActive: {
    backgroundColor: colors.heroSurface,
    borderColor: colors.heroEdge,
  },
  toggleChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  toggleChipTextActive: {
    color: colors.primary,
  },
  infoCard: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surfaceDk,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  infoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoCardTitle: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  infoCardDate: {
    color: colors.textMuted,
    fontSize: 11,
  },
  infoStatsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  infoStatItem: {
    flex: 1,
  },
  infoStatValue: {
    color: colors.textPrimary,
    fontSize: 21,
    fontWeight: '800',
  },
  infoStatLabel: {
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    marginTop: 3,
    letterSpacing: 0.8,
  },
  infoNote: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },
  chartCard: {
    marginBottom: 14,
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.surfaceDk,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 96,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 6,
  },
  barActive: {
    backgroundColor: colors.primary,
  },
  barInactive: {
    backgroundColor: colors.panelRaised,
  },
  barLabel: {
    color: colors.textMuted,
    fontSize: 10,
  },
  legendWrap: {
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
  },
  legendValue: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyChartText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
  },
  actionStack: {
    gap: spacing.sm,
  },
  })
}
