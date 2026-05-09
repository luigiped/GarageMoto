import { useEffect } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { router } from 'expo-router'
import { ActionButton } from '../src/components/ui/ActionButton'
import { AppScreen } from '../src/components/ui/AppScreen'
import { MetricTile } from '../src/components/ui/MetricTile'
import { Panel } from '../src/components/ui/Panel'
import { ScreenHeader } from '../src/components/ui/ScreenHeader'
import { useRefuelStore } from '../src/store/refuelStore'
import { useTripStore } from '../src/store/tripStore'
import { useVehicleStore } from '../src/store/vehicleStore'
import { colors, designPreset, font, radius, spacing } from '../src/theme'
import { buildPerformanceSummary, PERFORMANCE_DISCLAIMER } from '../src/utils/performanceBonus'
import { formatKm, formatKmL, formatPricePerLiter } from '../src/utils/formatters'

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
      <AppScreen>
        <ScreenHeader eyebrow="Performance" title="Nessun veicolo" subtitle="Seleziona una moto dal Garage per calcolare gli insight." />
      </AppScreen>
    )
  }

  const summary = buildPerformanceSummary(refuels, trips)

  return (
    <AppScreen>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <ScreenHeader
            eyebrow="Performance bonus"
            title="Lettura avanzata"
            subtitle={`Insight sperimentali per ${activeVehicle.nickname ?? `${activeVehicle.brand} ${activeVehicle.model}`}.`}
          />
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeText}>Chiudi</Text>
        </TouchableOpacity>
      </View>

      <Panel tone="warning" title="Disclaimer obbligatorio" subtitle={PERFORMANCE_DISCLAIMER} />

      {designPreset === 'glass' ? (
        <Panel tone="hero" title="Snapshot performance" subtitle="Lettura sintetica dei dati piu interessanti registrati finora.">
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryValue}>{formatKmL(summary.bestKmL)}</Text>
              <Text style={styles.summaryLabel}>miglior km/l</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryValue}>
                {summary.bestTripKm != null ? formatKm(summary.bestTripKm) : '--'}
              </Text>
              <Text style={styles.summaryLabel}>viaggio top</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryValue}>
                {summary.lowestPricePerLiter != null ? formatPricePerLiter(summary.lowestPricePerLiter) : '--'}
              </Text>
              <Text style={styles.summaryLabel}>prezzo minimo</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryValue}>
                {summary.recentEfficiencyDeltaPct != null ? `${summary.recentEfficiencyDeltaPct.toFixed(1)}%` : '--'}
              </Text>
              <Text style={styles.summaryLabel}>trend</Text>
            </View>
          </View>
        </Panel>
      ) : null}

      {designPreset !== 'glass' ? (
        <View style={styles.metricGrid}>
          <MetricTile label="Miglior km/l" value={formatKmL(summary.bestKmL)} tone="accent" />
          <MetricTile
            label="Prezzo piu basso"
            value={summary.lowestPricePerLiter != null ? formatPricePerLiter(summary.lowestPricePerLiter) : '--'}
            tone="warning"
          />
          <MetricTile
            label="Viaggio piu lungo"
            value={summary.bestTripKm != null ? formatKm(summary.bestTripKm) : '--'}
            tone="info"
          />
          <MetricTile
            label="Trend consumi"
            value={summary.recentEfficiencyDeltaPct != null ? `${summary.recentEfficiencyDeltaPct.toFixed(1)}%` : '--'}
          />
        </View>
      ) : null}

      <Panel title="Lettura rapida" subtitle="Indicazioni basate esclusivamente sui dati registrati nell’app.">
        {summary.insights.length > 0 ? (
          summary.insights.map((insight) => (
            <View key={insight} style={styles.insightRow}>
              <Text style={styles.insightBullet}>•</Text>
              <Text style={styles.insightText}>{insight}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Servono piu rifornimenti completi e viaggi per generare indicazioni utili.</Text>
        )}
      </Panel>

      <ActionButton label="Torna al cruscotto" variant="secondary" onPress={() => router.back()} />
    </AppScreen>
  )
}

const styles = StyleSheet.create({
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryCell: {
    flex: 1,
    minWidth: '47%',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceDk,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  summaryValue: {
    color: colors.textPrimary,
    fontSize: font.lg,
    fontWeight: '800',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  closeText: {
    color: colors.accentSoft,
    fontSize: font.sm,
    fontWeight: '700',
    marginTop: 6,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  insightBullet: {
    color: colors.primary,
    marginRight: spacing.sm,
    fontSize: font.base,
    lineHeight: 20,
  },
  insightText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: font.base,
    lineHeight: 22,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: font.sm,
    lineHeight: 20,
  },
})
