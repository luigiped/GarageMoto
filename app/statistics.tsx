import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useVehicleStore } from '../src/store/vehicleStore'
import { useRefuelStore } from '../src/store/refuelStore'
import { useTripStore } from '../src/store/tripStore'
import { formatEuro } from '../src/utils/formatters'
import {
  consumptionSeries,
  lastNMonths,
  monthLabel,
  monthlyKm,
  monthlySpending,
  periodSummary,
  priceSeries,
} from '../src/utils/statisticsCalculator'
import { colors, font, radius, spacing } from '../src/theme'

type Period = '1M' | '3M' | '6M' | '1A' | 'Tutto'
type ChartPoint = {
  label: string
  value: number
}

const PERIODS: Period[] = ['1M', '3M', '6M', '1A', 'Tutto']

function periodDays(period: Period): number {
  return period === '1M' ? 31 : period === '3M' ? 92 : period === '6M' ? 183 : period === '1A' ? 365 : 9999
}

export default function StatisticsScreen() {
  const { activeVehicle } = useVehicleStore()
  const { refuels, loadRefuels } = useRefuelStore()
  const { trips, loadTrips } = useTripStore()
  const [period, setPeriod] = useState<Period>('6M')

  useEffect(() => {
    if (!activeVehicle?.id) return
    loadRefuels(activeVehicle.id)
    loadTrips(activeVehicle.id)
  }, [activeVehicle?.id, loadRefuels, loadTrips])

  if (!activeVehicle) {
    return (
      <View style={s.center}>
        <Text style={s.emptyTitle}>Nessun veicolo</Text>
        <Text style={s.emptyText}>Seleziona una moto dal Garage.</Text>
      </View>
    )
  }

  const days = periodDays(period)
  const cutoff = period === 'Tutto'
    ? new Date(0)
    : new Date(Date.now() - days * 86400000)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  const filteredR = period === 'Tutto' ? refuels : refuels.filter((refuel) => refuel.date >= cutoffStr)
  const filteredT = period === 'Tutto' ? trips : trips.filter((trip) => trip.start_time.slice(0, 10) >= cutoffStr)

  const summary = periodSummary(filteredR, filteredT, cutoff, new Date())
  const monthKeys = lastNMonths(period === 'Tutto' ? 12 : period === '1A' ? 12 : period === '6M' ? 6 : period === '3M' ? 3 : 1)

  const spendingByMonth = monthlySpending(filteredR)
  const kmByMonth = monthlyKm(filteredT)
  const kmlPoints = consumptionSeries(filteredR).slice(-8).map((point) => ({
    label: point.date.slice(5),
    value: parseFloat(point.value.toFixed(1)),
  }))
  const fuelPricePoints = priceSeries(filteredR).slice(-8).map((point) => ({
    label: point.date.slice(5),
    value: parseFloat(point.value.toFixed(3)),
  }))
  const spendingPoints = monthKeys.map((key) => ({
    label: monthLabel(key),
    value: Math.round(spendingByMonth[key] ?? 0),
  }))
  const kmPoints = monthKeys.map((key) => ({
    label: monthLabel(key),
    value: Math.round(kmByMonth[key] ?? 0),
  }))

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.title}>Statistiche</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
        <View style={s.periodRow}>
          {PERIODS.map((value) => (
            <TouchableOpacity
              key={value}
              style={[s.chip, period === value && s.chipActive]}
              onPress={() => setPeriod(value)}
            >
              <Text style={{ color: period === value ? '#fff' : colors.textSecondary, fontSize: font.sm }}>
                {value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={s.summaryRow}>
        <SummaryCard label="Spesa" value={formatEuro(summary.totalEur)} />
        <SummaryCard label="Litri" value={`${summary.totalLiters.toFixed(1)} L`} />
        <SummaryCard label="Km percorsi" value={`${summary.totalKm.toFixed(0)} km`} />
        <SummaryCard label="Media km/l" value={summary.avgKmL != null ? summary.avgKmL.toFixed(1) : '--'} />
      </View>

      <ChartCard title="Consumo km/l (pieni completi)">
        <VerticalBarChart
          data={kmlPoints}
          color={colors.primary}
          emptyText="Aggiungi almeno 2 pieni completi"
          valueFormatter={(value) => `${value.toFixed(1)}`}
        />
      </ChartCard>

      <ChartCard title="Spesa mensile (€)">
        <VerticalBarChart
          data={spendingPoints}
          color={colors.primary}
          emptyText="Nessun rifornimento nel periodo"
          valueFormatter={(value) => `€${value.toFixed(0)}`}
        />
      </ChartCard>

      <ChartCard title="Km percorsi per mese">
        <VerticalBarChart
          data={kmPoints}
          color={colors.info}
          emptyText="Nessun viaggio registrato nel periodo"
          valueFormatter={(value) => `${value.toFixed(0)} km`}
        />
      </ChartCard>

      <ChartCard title="Prezzo carburante (€/L)">
        <VerticalBarChart
          data={fuelPricePoints}
          color={colors.warning}
          emptyText="Aggiungi almeno 2 rifornimenti"
          valueFormatter={(value) => `${value.toFixed(3)}`}
        />
      </ChartCard>
    </ScrollView>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.chartCard}>
      <Text style={s.chartTitle}>{title}</Text>
      {children}
    </View>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.summaryCard}>
      <Text style={s.summaryValue}>{value}</Text>
      <Text style={s.summaryLabel}>{label}</Text>
    </View>
  )
}

function VerticalBarChart({
  data,
  color,
  emptyText,
  valueFormatter,
}: {
  data: ChartPoint[]
  color: string
  emptyText: string
  valueFormatter: (value: number) => string
}) {
  const nonZero = data.filter((item) => item.value > 0)
  const maxValue = Math.max(...nonZero.map((item) => item.value), 0)

  if (nonZero.length === 0 || maxValue <= 0) {
    return (
      <View style={s.emptyChart}>
        <Text style={s.emptyText}>{emptyText}</Text>
      </View>
    )
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={s.chartRow}>
        {data.map((item) => {
          const height = item.value > 0 ? Math.max(16, (item.value / maxValue) * 120) : 8
          return (
            <View key={`${item.label}-${item.value}`} style={s.barItem}>
              <Text style={s.barValue}>{item.value > 0 ? valueFormatter(item.value) : '--'}</Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, { height, backgroundColor: color, opacity: item.value > 0 ? 1 : 0.25 }]} />
              </View>
              <Text style={s.barLabel}>{item.label}</Text>
            </View>
          )
        })}
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingTop: 56, paddingBottom: spacing.xl },
  center: { flex: 1, backgroundColor: colors.bgDark, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  title: { fontSize: font.xxl, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.md },
  emptyTitle: { fontSize: font.xl, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.sm },
  emptyText: { color: colors.textSecondary, textAlign: 'center', fontSize: font.sm },
  periodRow: { flexDirection: 'row', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  summaryCard: { flex: 1, minWidth: '45%', backgroundColor: colors.surfaceDk, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  summaryValue: { fontSize: font.lg, fontWeight: 'bold', color: colors.textPrimary },
  summaryLabel: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  chartCard: { backgroundColor: colors.surfaceDk, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, overflow: 'hidden' },
  chartTitle: { fontSize: font.md, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  emptyChart: { height: 100, justifyContent: 'center', alignItems: 'center' },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, paddingTop: spacing.sm },
  barItem: { width: 64, alignItems: 'center' },
  barValue: { color: colors.textPrimary, fontSize: 11, marginBottom: spacing.xs, textAlign: 'center' },
  barTrack: { width: 28, height: 124, borderRadius: radius.sm, backgroundColor: colors.cardDk, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: radius.sm },
  barLabel: { color: colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: spacing.xs },
})
