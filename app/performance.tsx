import { useEffect } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { router } from 'expo-router'
import { useVehicleStore } from '../src/store/vehicleStore'
import { useRefuelStore } from '../src/store/refuelStore'
import { useTripStore } from '../src/store/tripStore'
import { buildPerformanceSummary, PERFORMANCE_DISCLAIMER } from '../src/utils/performanceBonus'
import { formatKm, formatKmL, formatPricePerLiter } from '../src/utils/formatters'
import { colors, font, radius, spacing } from '../src/theme'

export default function PerformanceScreen() {
  const { activeVehicle } = useVehicleStore()
  const { refuels, loadRefuels } = useRefuelStore()
  const { trips, loadTrips } = useTripStore()

  useEffect(() => {
    if (!activeVehicle?.id) {
      return
    }
    loadRefuels(activeVehicle.id)
    loadTrips(activeVehicle.id)
  }, [activeVehicle?.id, loadRefuels, loadTrips])

  if (!activeVehicle) {
    return (
      <View style={s.center}>
        <Text style={s.title}>Performance bonus</Text>
        <Text style={s.emptyText}>Seleziona prima una moto dal Garage.</Text>
      </View>
    )
  }

  const summary = buildPerformanceSummary(refuels, trips)

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Performance bonus</Text>
          <Text style={s.subtitle}>
            Insight sperimentali per {activeVehicle.nickname ?? `${activeVehicle.brand} ${activeVehicle.model}`}
          </Text>
        </View>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>Chiudi</Text>
        </TouchableOpacity>
      </View>

      <View style={s.disclaimer}>
        <Text style={s.disclaimerLabel}>DISCLAIMER OBBLIGATORIO</Text>
        <Text style={s.disclaimerText}>{PERFORMANCE_DISCLAIMER}</Text>
      </View>

      <View style={s.grid}>
        <MetricCard label="Miglior km/l" value={formatKmL(summary.bestKmL)} />
        <MetricCard
          label="Prezzo piu basso"
          value={summary.lowestPricePerLiter != null ? formatPricePerLiter(summary.lowestPricePerLiter) : '--'}
        />
        <MetricCard
          label="Viaggio piu lungo"
          value={summary.bestTripKm != null ? formatKm(summary.bestTripKm) : '--'}
        />
        <MetricCard
          label="Trend consumi"
          value={summary.recentEfficiencyDeltaPct != null ? `${summary.recentEfficiencyDeltaPct.toFixed(1)}%` : '--'}
        />
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Lettura rapida</Text>
        {summary.insights.length > 0 ? (
          summary.insights.map((insight) => (
            <View key={insight} style={s.insightRow}>
              <Text style={s.insightBullet}>•</Text>
              <Text style={s.insightText}>{insight}</Text>
            </View>
          ))
        ) : (
          <Text style={s.emptyText}>
            Servono piu rifornimenti completi e viaggi registrati per generare suggerimenti utili.
          </Text>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Come leggerli</Text>
        <Text style={s.helperText}>
          I valori confrontano solo i dati che hai registrato nell&apos;app. Non sono misure da officina e non
          devono essere usati come base per modifiche meccaniche senza verifica reale.
        </Text>
      </View>
    </ScrollView>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metricCard}>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingTop: 56, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.bgDark },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  title: { fontSize: font.xxl, fontWeight: '700', color: colors.textPrimary },
  subtitle: { marginTop: 4, color: colors.textSecondary, fontSize: font.sm },
  backBtn: { marginLeft: spacing.sm, backgroundColor: colors.surfaceDk, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtnText: { color: colors.primary, fontSize: font.sm, fontWeight: '600' },
  disclaimer: { backgroundColor: 'rgba(255,159,10,0.12)', borderWidth: 1, borderColor: 'rgba(255,159,10,0.35)', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  disclaimerLabel: { color: colors.warning, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  disclaimerText: { color: colors.textPrimary, fontSize: font.sm, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  metricCard: { width: '48%', backgroundColor: colors.surfaceDk, borderRadius: radius.lg, padding: spacing.md },
  metricValue: { color: colors.textPrimary, fontSize: font.lg, fontWeight: '700', marginBottom: 4 },
  metricLabel: { color: colors.textSecondary, fontSize: font.sm },
  card: { backgroundColor: colors.surfaceDk, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  cardTitle: { color: colors.textPrimary, fontSize: font.md, fontWeight: '600', marginBottom: spacing.sm },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  insightBullet: { color: colors.primary, marginRight: spacing.sm, fontSize: font.base, lineHeight: 20 },
  insightText: { flex: 1, color: colors.textSecondary, fontSize: font.base, lineHeight: 20 },
  helperText: { color: colors.textSecondary, fontSize: font.sm, lineHeight: 20 },
  emptyText: { color: colors.textSecondary, fontSize: font.sm, lineHeight: 20, textAlign: 'center' },
})
