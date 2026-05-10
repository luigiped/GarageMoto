// R1.3 - completa il modulo performance con disclaimer persistente e test 0-100 stimato a basso rischio.
import { useEffect, useState } from 'react'
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
import { useTheme } from '../src/useTheme'
import { buildPerformanceSummary, PERFORMANCE_DISCLAIMER } from '../src/utils/performanceBonus'
import { formatKm, formatKmL, formatPricePerLiter } from '../src/utils/formatters'
import type {
  ZeroToHundredResult,
  ZeroToHundredSample,
  ZeroToHundredUpdate,
} from '../src/services/accelerometerService'

type PerformanceRuntime = {
  isAccelerationTestAvailable: typeof import('../src/services/accelerometerService').isAccelerationTestAvailable
  startZeroToHundredTest: typeof import('../src/services/accelerometerService').startZeroToHundredTest
  stopZeroToHundredTest: typeof import('../src/services/accelerometerService').stopZeroToHundredTest
  acceptPerformanceDisclaimer: typeof import('../src/services/performanceConsent').acceptPerformanceDisclaimer
  hasAcceptedPerformanceDisclaimer: typeof import('../src/services/performanceConsent').hasAcceptedPerformanceDisclaimer
}

let performanceRuntimePromise: Promise<PerformanceRuntime> | null = null

async function loadPerformanceRuntime(): Promise<PerformanceRuntime> {
  if (!performanceRuntimePromise) {
    performanceRuntimePromise = Promise.all([
      import('../src/services/accelerometerService'),
      import('../src/services/performanceConsent'),
    ]).then(([accelerometerService, consentService]) => ({
      isAccelerationTestAvailable: accelerometerService.isAccelerationTestAvailable,
      startZeroToHundredTest: accelerometerService.startZeroToHundredTest,
      stopZeroToHundredTest: accelerometerService.stopZeroToHundredTest,
      acceptPerformanceDisclaimer: consentService.acceptPerformanceDisclaimer,
      hasAcceptedPerformanceDisclaimer: consentService.hasAcceptedPerformanceDisclaimer,
    }))
  }

  return performanceRuntimePromise
}

export default function PerformanceScreen() {
  const theme = useTheme()
  const styles = createStyles(theme)
  const { colors, designPreset } = theme
  const { activeVehicle } = useVehicleStore()
  const { refuels, loadRefuels } = useRefuelStore()
  const { trips, loadTrips } = useTripStore()
  const [consentLoaded, setConsentLoaded] = useState(false)
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [consentChecked, setConsentChecked] = useState(false)
  const [testAvailable, setTestAvailable] = useState<boolean | null>(null)
  const [availabilityLoading, setAvailabilityLoading] = useState(true)
  const [isStartingTest, setIsStartingTest] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [liveUpdate, setLiveUpdate] = useState<ZeroToHundredUpdate | null>(null)
  const [lastResult, setLastResult] = useState<ZeroToHundredResult | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  useEffect(() => {
    if (!activeVehicle?.id) {
      return
    }
    loadRefuels(activeVehicle.id)
    loadTrips(activeVehicle.id)
  }, [activeVehicle?.id, loadRefuels, loadTrips])

  useEffect(() => {
    let cancelled = false

    async function loadRuntimeState() {
      try {
        const runtime = await loadPerformanceRuntime()
        const [accepted, available] = await Promise.all([
          runtime.hasAcceptedPerformanceDisclaimer(),
          runtime.isAccelerationTestAvailable(),
        ])

        if (cancelled) {
          return
        }

        setConsentAccepted(accepted)
        setTestAvailable(available)
      } catch (error) {
        console.error('[performance] runtime state:', error)
        if (!cancelled) {
          setTestAvailable(false)
        }
      } finally {
        if (!cancelled) {
          setConsentLoaded(true)
          setAvailabilityLoading(false)
        }
      }
    }

    void loadRuntimeState()

    return () => {
      cancelled = true
      loadPerformanceRuntime()
        .then((runtime) => {
          runtime.stopZeroToHundredTest()
        })
        .catch((error) => {
          console.warn('[performance] runtime cleanup skipped:', error)
        })
    }
  }, [])

  const summary = buildPerformanceSummary(refuels, trips)
  const chartSamples = liveUpdate?.samples.length ? liveUpdate.samples : lastResult?.samples ?? []

  if (!activeVehicle) {
    return (
      <AppScreen>
        <ScreenHeader eyebrow="Performance" title="Nessun veicolo" subtitle="Seleziona una moto dal Garage per calcolare gli insight." />
      </AppScreen>
    )
  }

  async function handleAcceptConsent() {
    try {
      const runtime = await loadPerformanceRuntime()
      await runtime.acceptPerformanceDisclaimer()
      setConsentAccepted(true)
      setConsentChecked(false)
    } catch (error) {
      console.error('[performance] accept disclaimer:', error)
      setTestError('Impossibile salvare la conferma del disclaimer.')
    }
  }

  async function handleStartAccelerationTest() {
    setTestError(null)
    setLastResult(null)
    setLiveUpdate(null)
    setIsStartingTest(true)
    setIsTesting(true)

    try {
      const runtime = await loadPerformanceRuntime()
      await runtime.startZeroToHundredTest({
        onUpdate: (update) => {
          setLiveUpdate(update)
        },
        onComplete: (result) => {
          setLiveUpdate(result)
          setLastResult(result)
          setIsTesting(false)
          setIsStartingTest(false)
        },
        onError: (error) => {
          console.error('[performance] acceleration test:', error)
          setTestError(error.message)
          setIsTesting(false)
          setIsStartingTest(false)
        },
      })
    } catch (error) {
      console.error('[performance] start acceleration test:', error)
      setTestError(error instanceof Error ? error.message : 'Impossibile avviare il test 0-100.')
      setIsTesting(false)
      setIsStartingTest(false)
    } finally {
      setIsStartingTest(false)
    }
  }

  function handleStopAccelerationTest() {
    loadPerformanceRuntime()
      .then((runtime) => {
        runtime.stopZeroToHundredTest()
      })
      .catch((error) => {
        console.warn('[performance] stop test skipped:', error)
      })
    setIsTesting(false)
    if (!liveUpdate) {
      return
    }

    const cancelledResult: ZeroToHundredResult = {
      ...liveUpdate,
      status: 'cancelled',
      reachedTarget: false,
      timeToHundredSec: null,
      finishReason: 'cancelled',
    }
    setLiveUpdate(cancelledResult)
    setLastResult(cancelledResult)
  }

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

      {!consentAccepted ? (
        <Panel
          tone="info"
          title="Conferma iniziale"
          subtitle="Prima di usare il modulo performance devi confermare di aver letto il disclaimer."
        >
          <TouchableOpacity style={styles.checkboxRow} onPress={() => setConsentChecked((prev) => !prev)}>
            <View style={[styles.checkbox, consentChecked && styles.checkboxActive]}>
              {consentChecked ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={styles.checkboxText}>Ho capito che i dati sono solo indicativi e non professionali.</Text>
          </TouchableOpacity>
          <ActionButton
            label={consentLoaded ? 'Ho capito e continuo' : 'Caricamento'}
            variant="primary"
            onPress={() => { void handleAcceptConsent() }}
            disabled={!consentChecked || !consentLoaded}
          />
        </Panel>
      ) : null}

      <Panel
        tone="hero"
        title="Test 0-100 stimato"
        subtitle="Avvia il test con telefono fissato verticalmente al manubrio. La misura usa solo i sensori dello smartphone."
      >
        <View style={styles.infoStrip}>
          <Text style={styles.infoLabel}>Disponibilita sensore</Text>
          <Text style={styles.infoValue}>
            {availabilityLoading ? 'Verifica in corso' : testAvailable ? 'Accelerometro pronto' : 'Non disponibile'}
          </Text>
        </View>
        <View style={styles.infoStrip}>
          <Text style={styles.infoLabel}>Stato test</Text>
          <Text style={styles.infoValue}>{formatTestStatus(liveUpdate?.status ?? lastResult?.status ?? null)}</Text>
        </View>
        <Text style={styles.noteText}>
          Valido solo per run brevi e su supporto stabile. L’errore cresce nel tempo: usa il risultato come riferimento.
        </Text>
        <View style={styles.actionsCol}>
          <ActionButton
            label={isTesting ? 'Test in corso' : 'Avvia test 0-100'}
            variant="warning"
            onPress={() => { void handleStartAccelerationTest() }}
            disabled={!consentAccepted || !testAvailable || isTesting}
            loading={isStartingTest}
          />
          {isTesting ? (
            <ActionButton label="Ferma test" variant="secondary" onPress={handleStopAccelerationTest} />
          ) : null}
        </View>
        {testError ? <Text style={styles.errorText}>{testError}</Text> : null}
        <View style={styles.metricGrid}>
          <MetricTile
            label="Velocita stimata"
            value={liveUpdate != null ? `${liveUpdate.estimatedSpeedKmh.toFixed(1)} km/h` : '--'}
            tone="accent"
          />
          <MetricTile
            label="Max accelerazione"
            value={liveUpdate != null ? `${liveUpdate.maxAccelerationG.toFixed(2)} g` : '--'}
            tone="warning"
          />
          <MetricTile
            label="Tempo 0-100"
            value={lastResult?.timeToHundredSec != null ? `${lastResult.timeToHundredSec.toFixed(1)} s` : '--'}
            tone="info"
          />
          <MetricTile
            label="Esito"
            value={formatFinishReason(lastResult?.finishReason ?? null)}
          />
        </View>
        {chartSamples.length > 0 ? (
          <View style={styles.chartWrap}>
            <Text style={styles.chartTitle}>Grafico velocita nel tempo</Text>
            <View style={styles.chartRow}>
              {chartSamples.slice(-18).map((sample, index) => (
                <ChartBar key={`${sample.elapsedMs}-${index}`} sample={sample} maxSpeed={maxSampleSpeed(chartSamples)} />
              ))}
            </View>
          </View>
        ) : null}
      </Panel>

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

function ChartBar({
  sample,
  maxSpeed,
}: {
  sample: ZeroToHundredSample
  maxSpeed: number
}) {
  const theme = useTheme()
  const styles = createStyles(theme)
  const heightPct = maxSpeed > 0 ? Math.max(10, Math.round((sample.speedKmh / maxSpeed) * 100)) : 10

  return (
    <View style={styles.chartBarSlot}>
      <View style={[styles.chartBar, { height: `${heightPct}%` }]} />
    </View>
  )
}

function formatTestStatus(status: ZeroToHundredUpdate['status'] | ZeroToHundredResult['status'] | null): string {
  if (status === 'arming') {
    return 'Calibrazione'
  }
  if (status === 'waiting_trigger') {
    return 'In attesa di accelerazione'
  }
  if (status === 'running') {
    return 'In esecuzione'
  }
  if (status === 'finished') {
    return 'Concluso'
  }
  if (status === 'cancelled') {
    return 'Interrotto'
  }
  return 'Pronto'
}

function formatFinishReason(reason: ZeroToHundredResult['finishReason'] | null): string {
  if (reason === 'target') {
    return '100 km/h raggiunti'
  }
  if (reason === 'idle') {
    return 'Movimento terminato'
  }
  if (reason === 'timeout') {
    return 'Timeout'
  }
  if (reason === 'cancelled') {
    return 'Interrotto'
  }
  return '--'
}

function maxSampleSpeed(samples: ZeroToHundredSample[]): number {
  return samples.reduce((max, sample) => Math.max(max, sample.speedKmh), 0)
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
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.cardDk,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    checkboxActive: {
      borderColor: colors.primaryEdge,
      backgroundColor: colors.primary,
    },
    checkboxMark: {
      color: '#fff',
      fontWeight: '800',
      fontSize: font.sm,
    },
    checkboxText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: font.base,
      lineHeight: 22,
    },
    infoStrip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    infoLabel: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: font.base,
    },
    infoValue: {
      color: colors.textPrimary,
      fontSize: font.base,
      fontWeight: '700',
    },
    noteText: {
      color: colors.textSecondary,
      fontSize: font.sm,
      lineHeight: 20,
      marginBottom: spacing.md,
    },
    actionsCol: {
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    errorText: {
      color: colors.error,
      fontSize: font.sm,
      marginBottom: spacing.md,
    },
    chartWrap: {
      marginTop: spacing.sm,
    },
    chartTitle: {
      color: colors.textPrimary,
      fontSize: font.sm,
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    chartRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
      minHeight: 110,
      padding: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardDk,
    },
    chartBarSlot: {
      flex: 1,
      minHeight: 90,
      justifyContent: 'flex-end',
    },
    chartBar: {
      width: '100%',
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      minHeight: 8,
    },
  })
}
