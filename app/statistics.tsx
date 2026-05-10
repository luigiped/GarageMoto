import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { AppScreen } from '../src/components/ui/AppScreen'
import { MetricTile } from '../src/components/ui/MetricTile'
import { Panel } from '../src/components/ui/Panel'
import { ScreenHeader } from '../src/components/ui/ScreenHeader'
import { useRefuelStore } from '../src/store/refuelStore'
import { useTripStore } from '../src/store/tripStore'
import { useVehicleStore } from '../src/store/vehicleStore'
import { useTheme } from '../src/useTheme'
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

type Period = '1M' | '3M' | '6M' | '1A' | 'Tutto'
type ChartPoint = { label: string; value: number }

const PERIODS: Period[] = ['1M', '3M', '6M', '1A', 'Tutto']

export default function StatisticsScreen() {
  const theme = useTheme()
  const styles = createStyles(theme)
  const { colors, designPreset } = theme
  const { activeVehicle } = useVehicleStore()
  const { refuels, loadRefuels } = useRefuelStore()
  const { trips, loadTrips } = useTripStore()
  const [period, setPeriod] = useState<Period>('6M')

  useEffect(() => {
    if (!activeVehicle?.id) {
      return
    }
    loadRefuels(activeVehicle.id)
    loadTrips(activeVehicle.id)
  }, [activeVehicle?.id, loadRefuels, loadTrips])

  if (!activeVehicle) {
    return (
      <AppScreen>
        <ScreenHeader eyebrow="Statistiche" title="Nessun veicolo" subtitle="Seleziona una moto dal Garage per vedere i grafici." />
      </AppScreen>
    )
  }

  const days = period === '1M' ? 31 : period === '3M' ? 92 : period === '6M' ? 183 : period === '1A' ? 365 : 9999
  const cutoff = period === 'Tutto' ? new Date(0) : new Date(Date.now() - days * 86400000)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  const filteredR = period === 'Tutto' ? refuels : refuels.filter((item) => item.date >= cutoffStr)
  const filteredT = period === 'Tutto' ? trips : trips.filter((item) => item.start_time.slice(0, 10) >= cutoffStr)
  const summary = periodSummary(filteredR, filteredT, cutoff, new Date())
  const monthKeys = lastNMonths(period === 'Tutto' ? 12 : period === '1A' ? 12 : period === '6M' ? 6 : period === '3M' ? 3 : 1)

  const kmlPoints = consumptionSeries(filteredR).slice(-8).map((point) => ({ label: point.date.slice(5), value: parseFloat(point.value.toFixed(1)) }))
  const fuelPricePoints = priceSeries(filteredR).slice(-8).map((point) => ({ label: point.date.slice(5), value: parseFloat(point.value.toFixed(3)) }))
  const spendingByMonth = monthlySpending(filteredR)
  const spendingPoints = monthKeys.map((key) => ({ label: monthLabel(key), value: Math.round(spendingByMonth[key] ?? 0) }))
  const kmByMonth = monthlyKm(filteredT)
  const kmPoints = monthKeys.map((key) => ({ label: monthLabel(key), value: Math.round(kmByMonth[key] ?? 0) }))

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Analisi"
        title="Statistiche"
        subtitle={`Andamento di consumi, costi e percorrenza per ${activeVehicle.nickname ?? `${activeVehicle.brand} ${activeVehicle.model}`}.`}
      />

      {designPreset === 'glass' ? (
        <Panel
          tone="hero"
          title="Quadro analitico"
          subtitle={`Periodo attivo: ${period}. I blocchi sotto seguono lo stesso filtro temporale.`}
        >
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryValue}>{summary.avgKmL != null ? summary.avgKmL.toFixed(1) : '--'}</Text>
              <Text style={styles.summaryLabel}>media km/l</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryValue}>{summary.totalKm.toFixed(0)}</Text>
              <Text style={styles.summaryLabel}>km totali</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryValue}>{formatEuro(summary.totalEur)}</Text>
              <Text style={styles.summaryLabel}>spesa</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryValue}>{summary.totalLiters.toFixed(0)}</Text>
              <Text style={styles.summaryLabel}>litri</Text>
            </View>
          </View>
        </Panel>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll}>
        <View style={styles.periodRow}>
          {PERIODS.map((value) => (
            <TouchableOpacity
              key={value}
              style={[styles.chip, period === value && styles.chipActive]}
              onPress={() => setPeriod(value)}
            >
              <Text style={[styles.chipText, period === value && styles.chipTextActive]}>{value}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {designPreset !== 'glass' ? (
        <View style={styles.metricGrid}>
          <MetricTile label="Spesa" value={formatEuro(summary.totalEur)} tone="warning" />
          <MetricTile label="Litri" value={`${summary.totalLiters.toFixed(1)} L`} />
          <MetricTile label="Km percorsi" value={`${summary.totalKm.toFixed(0)} km`} tone="info" />
          <MetricTile label="Media km/l" value={summary.avgKmL != null ? summary.avgKmL.toFixed(1) : '--'} tone="accent" />
        </View>
      ) : null}

      <ChartPanel title="Consumo km/l" subtitle="Solo pieni completi in ordine cronologico." color={colors.primary} data={kmlPoints} emptyText="Aggiungi almeno 2 pieni completi" valueFormatter={(value) => `${value.toFixed(1)}`} />
      <ChartPanel title="Spesa mensile" subtitle="Importo aggregato per mese nel periodo attivo." color={colors.warning} data={spendingPoints} emptyText="Nessun rifornimento nel periodo" valueFormatter={(value) => `€${value.toFixed(0)}`} />
      <ChartPanel title="Km viaggi per mese" subtitle="Distanza aggregata dai viaggi registrati." color={colors.info} data={kmPoints} emptyText="Nessun viaggio registrato" valueFormatter={(value) => `${value.toFixed(0)} km`} />
      <ChartPanel title="Prezzo carburante €/L" subtitle="Serie storica degli ultimi rifornimenti del periodo." color={colors.accentSoft} data={fuelPricePoints} emptyText="Aggiungi almeno 2 rifornimenti" valueFormatter={(value) => `${value.toFixed(3)}`} />
    </AppScreen>
  )
}

function ChartPanel({
  title,
  subtitle,
  color,
  data,
  emptyText,
  valueFormatter,
}: {
  title: string
  subtitle: string
  color: string
  data: ChartPoint[]
  emptyText: string
  valueFormatter: (value: number) => string
}) {
  const styles = createStyles(useTheme())
  const nonZero = data.filter((item) => item.value > 0)
  const maxValue = Math.max(...nonZero.map((item) => item.value), 0)

  return (
    <Panel title={title} subtitle={subtitle}>
      {nonZero.length === 0 || maxValue <= 0 ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chartRow}>
            {data.map((item) => {
              const height = item.value > 0 ? Math.max(16, (item.value / maxValue) * 140) : 10
              return (
                <View key={`${item.label}-${item.value}`} style={styles.barItem}>
                  <Text style={styles.barValue}>{item.value > 0 ? valueFormatter(item.value) : '--'}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { height, backgroundColor: color, opacity: item.value > 0 ? 1 : 0.18 }]} />
                  </View>
                  <Text style={styles.barLabel}>{item.label}</Text>
                </View>
              )
            })}
          </View>
        </ScrollView>
      )}
    </Panel>
  )
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  const { colors, font, radius, spacing } = theme

  return StyleSheet.create({
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    summaryCell: {
      flex: 1,
      minWidth: '47%',
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceDk,
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
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: 4,
    },
    periodScroll: {
      marginBottom: spacing.md,
    },
    periodRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.panelRaised,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primaryEdge,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: font.sm,
      fontWeight: '700',
    },
    chipTextActive: {
      color: '#fff',
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    chartRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    barItem: {
      width: 70,
      alignItems: 'center',
    },
    barValue: {
      color: colors.textPrimary,
      fontSize: 11,
      marginBottom: spacing.xs,
      textAlign: 'center',
    },
    barTrack: {
      width: 30,
      height: 144,
      borderRadius: radius.md,
      backgroundColor: colors.cardDk,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    barFill: {
      width: '100%',
      borderRadius: radius.md,
    },
    barLabel: {
      color: colors.textMuted,
      fontSize: 10,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: font.sm,
      textAlign: 'center',
      paddingVertical: spacing.md,
    },
  })
}
