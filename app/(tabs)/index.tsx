// R1.1 - aggiunta card ultimo viaggio
import { useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import type { Href } from 'expo-router'
import { useAuthStore } from '../../src/store/authStore'
import { useVehicleStore } from '../../src/store/vehicleStore'
import { useRefuelStore } from '../../src/store/refuelStore'
import { useMaintenanceStore } from '../../src/store/maintenanceStore'
import { useTripStore } from '../../src/store/tripStore' // R1.1
import { averageConsumption, estimatedRange, currentMonthSpending } from '../../src/utils/fuelCalculator'
import { getStatus } from '../../src/utils/maintenanceChecker'
import { formatEuro, formatDate } from '../../src/utils/formatters'
import { colors, spacing, radius, font } from '../../src/theme'

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.kpiCard}>
      <Text style={s.kpiLabel}>{label.toUpperCase()}</Text>
      <Text style={s.kpiValue}>{value}</Text>
    </View>
  )
}

const PERFORMANCE_ROUTE = '/performance' as Href

export default function DashboardScreen() {
  const { user } = useAuthStore()
  const { activeVehicle, loadVehicles } = useVehicleStore()
  const { refuels, loadRefuels } = useRefuelStore()
  const { items: maintenance, loadMaintenance } = useMaintenanceStore()
  const { trips, loadTrips } = useTripStore() // R1.1

  useEffect(() => { if (user?.id) loadVehicles(user.id) }, [user?.id])

  useEffect(() => {
    if (!activeVehicle?.id) return
    loadRefuels(activeVehicle.id)
    loadMaintenance(activeVehicle.id)
    loadTrips(activeVehicle.id) // R1.1
  }, [activeVehicle?.id])

  if (!activeVehicle) {
    return (
      <View style={s.center}>
        <Text style={s.emptyIcon}>🏍️</Text>
        <Text style={s.emptyTitle}>Nessun veicolo</Text>
        <Text style={s.emptyText}>Aggiungi la tua moto per iniziare.</Text>
        <TouchableOpacity style={s.btn} onPress={() => router.push('/garage')}>
          <Text style={s.btnText}>Aggiungi moto</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const currentKm   = refuels[0]?.odometer_km ?? activeVehicle.odometer_start_km
  const avg         = averageConsumption(refuels)
  const lastKml     = refuels[0]?.km_per_liter ?? null
  const range       = estimatedRange(activeVehicle.tank_capacity_l, refuels, currentKm)
  const monthSpend  = currentMonthSpending(refuels)
  const lastRefuel  = refuels[0]
  const lastTrip    = trips[0] // R1.1
  const overdue     = maintenance.filter(m => getStatus(m, currentKm) === 'overdue')
  const warning     = maintenance.filter(m => getStatus(m, currentKm) === 'warning')
  const isOverdue   = overdue.length > 0

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.screenLabel}>Dashboard</Text>
      <Text style={s.vehicleName}>
        {activeVehicle.nickname ?? `${activeVehicle.brand} ${activeVehicle.model}`}
      </Text>

      {/* Alert manutenzione */}
      {(overdue.length > 0 || warning.length > 0) && (
        <TouchableOpacity
          style={[s.alertBanner, { borderColor: isOverdue ? colors.error : colors.warning }]}
          onPress={() => router.push('/maintenance')}
        >
          <Text style={{ fontSize: 16, marginRight: spacing.sm }}>{isOverdue ? '🔴' : '🟡'}</Text>
          <Text style={[s.alertText, { color: isOverdue ? colors.error : colors.warning }]}>
            {isOverdue
              ? `${overdue.length} manutenzione/i scaduta/e`
              : `${warning.length} manutenzione/i in scadenza`}
          </Text>
          <Text style={{ color: colors.textMuted }}>›</Text>
        </TouchableOpacity>
      )}

      {/* KPI 2x2 */}
      <View style={s.kpiGrid}>
        <View style={s.kpiRow}>
          <KpiCard label="Ultimo km/l" value={lastKml != null ? `${lastKml.toFixed(1)} km/l` : '--'} />
          <View style={{ width: spacing.sm }} />
          <KpiCard label="Media km/l"  value={avg != null ? `${avg.toFixed(1)} km/l` : '--'} />
        </View>
        <View style={{ height: spacing.sm }} />
        <View style={s.kpiRow}>
          <KpiCard label="Autonomia" value={range != null ? `${Math.round(range)} km` : '--'} />
          <View style={{ width: spacing.sm }} />
          <KpiCard label="Spesa mese" value={formatEuro(monthSpend)} />
        </View>
      </View>

      {/* Card ultimo rifornimento */}
      {lastRefuel && (
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>⛽ Ultimo rifornimento</Text>
            <Text style={s.cardDate}>{formatDate(lastRefuel.date)}</Text>
          </View>
          <View style={s.cardRow}>
            <Stat value={`${lastRefuel.liters.toFixed(2)} L`} label="litri" />
            <Stat value={formatEuro(lastRefuel.amount_eur)} label="importo" />
            {lastRefuel.km_per_liter != null && (
              <Stat value={`${lastRefuel.km_per_liter.toFixed(1)} km/l`} label="consumo" />
            )}
          </View>
        </View>
      )}

      {/* R1.1 - Card ultimo viaggio */}
      {lastTrip && (
        <TouchableOpacity style={s.card} onPress={() => router.push('./trips')}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>🗺️ Ultimo viaggio</Text>
            <Text style={s.cardDate}>{formatDate(lastTrip.start_time.slice(0, 10))}</Text>
          </View>
          <View style={s.cardRow}>
            <Stat value={`${lastTrip.distance_km.toFixed(1)} km`} label="distanza" />
            <Stat value={`${lastTrip.duration_minutes} min`}       label="durata" />
            <Stat value={`${lastTrip.avg_speed_kmh.toFixed(0)} km/h`} label="media" />
          </View>
        </TouchableOpacity>
      )}

      {/* Collegamento statistiche */}
      <TouchableOpacity
        style={[s.btn, { backgroundColor: colors.surfaceDk }]}
        onPress={() => router.push('/statistics')}
      >
        <Text style={[s.btnText, { color: colors.primary }]}>📊 Vedi statistiche complete</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.btn, { backgroundColor: 'rgba(255,159,10,0.12)', borderWidth: 1, borderColor: 'rgba(255,159,10,0.3)' }]}
        onPress={() => router.push(PERFORMANCE_ROUTE)}
      >
        <Text style={[s.btnText, { color: colors.warning }]}>🏁 Apri performance bonus</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View>
      <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: font.base }}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: font.sm }}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bgDark },
  content:     { padding: spacing.md, paddingTop: 56, paddingBottom: spacing.xl },
  center:      { flex: 1, backgroundColor: colors.bgDark, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  screenLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 4 },
  vehicleName: { fontSize: font.xxl, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.lg },
  emptyIcon:   { fontSize: 56, marginBottom: spacing.md },
  emptyTitle:  { fontSize: font.xl, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.sm },
  emptyText:   { fontSize: font.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  alertBanner: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, padding: spacing.sm + 2, marginBottom: spacing.md, backgroundColor: 'rgba(255,59,48,0.05)' },
  alertText:   { flex: 1, fontSize: font.sm, fontWeight: '500' },
  kpiGrid:     { marginBottom: spacing.md },
  kpiRow:      { flexDirection: 'row' },
  kpiCard:     { flex: 1, backgroundColor: colors.surfaceDk, borderRadius: radius.lg, padding: spacing.md },
  kpiLabel:    { fontSize: 10, color: colors.textSecondary, letterSpacing: 0.5, marginBottom: 4 },
  kpiValue:    { fontSize: font.xxl, fontWeight: 'bold', color: colors.textPrimary },
  card:        { backgroundColor: colors.surfaceDk, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  cardTitle:   { fontSize: font.sm, fontWeight: '500', color: colors.primary },
  cardDate:    { fontSize: font.sm, color: colors.textMuted },
  cardRow:     { flexDirection: 'row', gap: spacing.lg },
  btn:         { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm },
  btnText:     { color: '#fff', fontWeight: '600', fontSize: font.base },
})
