import { useEffect, useState } from 'react'
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { ActionButton } from '../../src/components/ui/ActionButton'
import { AppScreen } from '../../src/components/ui/AppScreen'
import { Panel } from '../../src/components/ui/Panel'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { StatusPill } from '../../src/components/ui/StatusPill'
import { useAuthStore } from '../../src/store/authStore'
import { useRefuelStore } from '../../src/store/refuelStore'
import { useVehicleStore } from '../../src/store/vehicleStore'
import { colors, designPreset, font, radius, spacing } from '../../src/theme'
import type { Refuel } from '../../src/types/refuel'
import { averageConsumption } from '../../src/utils/fuelCalculator'
import { formatDate, formatEuro, todayISO } from '../../src/utils/formatters'
import { parseReceiptText } from '../../src/utils/receiptParser'

type Period = 'all' | '1m' | '3m' | '1y'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'all', label: 'Tutto' },
  { value: '1m', label: '1 mese' },
  { value: '3m', label: '3 mesi' },
  { value: '1y', label: '1 anno' },
]

export default function RefuelsScreen() {
  const { user } = useAuthStore()
  const { activeVehicle } = useVehicleStore()
  const { refuels, loadRefuels, addRefuel, deleteRefuel } = useRefuelStore()
  const [period, setPeriod] = useState<Period>('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(todayISO())
  const [odometer, setOdometer] = useState('')
  const [liters, setLiters] = useState('')
  const [amount, setAmount] = useState('')
  const [fullTank, setFullTank] = useState(true)
  const [notes, setNotes] = useState('')
  const [receiptText, setReceiptText] = useState('')
  const [receiptImageUri, setReceiptImageUri] = useState<string | null>(null)
  const [parsingReceipt, setParsingReceipt] = useState(false)

  const ppl = liters && amount && parseFloat(liters) > 0
    ? (parseFloat(amount.replace(',', '.')) / parseFloat(liters.replace(',', '.'))).toFixed(3)
    : null

  useEffect(() => {
    if (activeVehicle?.id) {
      loadRefuels(activeVehicle.id)
    }
  }, [activeVehicle?.id, loadRefuels])

  async function handleAdd() {
    if (!odometer || !liters || !amount) {
      Alert.alert('Campi mancanti', 'Compila odometro, litri e importo.')
      return
    }
    if (!activeVehicle || !user?.id) {
      return
    }
    setSaving(true)
    const kml = await addRefuel({
      user_id: user.id,
      vehicle_id: activeVehicle.id,
      date,
      odometer_km: Number.parseInt(odometer, 10),
      liters: Number.parseFloat(liters.replace(',', '.')),
      amount_eur: Number.parseFloat(amount.replace(',', '.')),
      is_full_tank: fullTank,
      notes: notes.trim() || undefined,
    })
    setSaving(false)
    setShowForm(false)
    setOdometer('')
    setLiters('')
    setAmount('')
    setNotes('')
    setDate(todayISO())
    setFullTank(true)
    setReceiptText('')
    setReceiptImageUri(null)
    Alert.alert('Salvato', kml ? `Rifornimento registrato. km/l: ${kml}` : 'Rifornimento registrato.')
  }

  async function handlePickReceiptImage() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Permesso richiesto', 'Serve accesso alla galleria per selezionare lo scontrino.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      })
      if (!result.canceled) {
        setReceiptImageUri(result.assets[0]?.uri ?? null)
      }
    } catch (error) {
      console.error('[refuels] pick receipt:', error)
      Alert.alert('Errore', 'Impossibile aprire la galleria.')
    }
  }

  function handleApplyReceiptText() {
    if (!receiptText.trim()) {
      Alert.alert('OCR assistito', 'Incolla prima il testo estratto dallo scontrino.')
      return
    }
    setParsingReceipt(true)
    const parsed = parseReceiptText(receiptText)
    if (parsed.date) {
      setDate(parsed.date)
    }
    if (parsed.liters != null) {
      setLiters(parsed.liters.toFixed(2))
    }
    if (parsed.amountEur != null) {
      setAmount(parsed.amountEur.toFixed(2))
    }
    if (!notes.trim() && receiptImageUri) {
      setNotes('Scontrino allegato manualmente')
    }
    setParsingReceipt(false)

    if (parsed.warnings.length > 0) {
      Alert.alert('Controlla i dati', parsed.warnings.join('\n'))
    } else {
      Alert.alert('Campi compilati', 'Verifica i valori riconosciuti e completa l’odometro.')
    }
  }

  const avg = averageConsumption(refuels)
  const filtered = filterByPeriod(refuels, period)
  const totalSpend = filtered.reduce((sum, item) => sum + item.amount_eur, 0)
  const partialCount = filtered.filter((item) => !item.is_full_tank).length

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Fuel log"
        title="Carburante"
        subtitle="Timeline dei pieni, costo per litro e compilazione assistita dello scontrino."
      />

      {!activeVehicle ? (
        <Panel title="Veicolo richiesto" subtitle="Seleziona prima una moto dal Garage per registrare rifornimenti.">
          <Text style={styles.centerIcon}>⛽</Text>
        </Panel>
      ) : (
        <>
          {designPreset === 'glass' ? (
            <Panel
              tone="hero"
              title={`${activeVehicle.brand} ${activeVehicle.model}`}
              subtitle="Fuel deck con consumi, spesa e stato compilazione."
            >
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryValue}>{filtered.length}</Text>
                  <Text style={styles.summaryLabel}>record nel filtro</Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryValue}>{avg != null ? avg.toFixed(1) : '--'}</Text>
                  <Text style={styles.summaryLabel}>media km/l</Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryValue}>{formatEuro(totalSpend)}</Text>
                  <Text style={styles.summaryLabel}>spesa periodo</Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryValue}>{partialCount}</Text>
                  <Text style={styles.summaryLabel}>parziali</Text>
                </View>
              </View>
            </Panel>
          ) : null}

          <View style={styles.topCtaWrap}>
            <ActionButton
              label={showForm ? 'Chiudi inserimento' : 'Nuovo rifornimento'}
              variant={showForm ? 'secondary' : 'primary'}
              onPress={() => setShowForm((prev) => !prev)}
            />
          </View>

          {showForm && (
            <Panel tone="hero" title="Nuovo rifornimento" subtitle="Il km/l viene calcolato solo sui pieni completi.">
              <Panel
                title="OCR scontrino"
                subtitle="Seleziona uno scontrino e incolla il testo estratto, ad esempio da Google Lens."
                tone="default"
              >
                <View style={styles.actionsCol}>
                  <ActionButton
                    label={receiptImageUri ? 'Cambia immagine scontrino' : 'Seleziona scontrino'}
                    variant="secondary"
                    onPress={() => { void handlePickReceiptImage() }}
                  />
                  <ActionButton
                    label={parsingReceipt ? 'Analisi in corso' : 'Applica testo OCR'}
                    variant="secondary"
                    onPress={handleApplyReceiptText}
                    loading={parsingReceipt}
                  />
                </View>
                {receiptImageUri ? <Image source={{ uri: receiptImageUri }} style={styles.receiptPreview} /> : null}
                <TextInput
                  style={styles.receiptInput}
                  value={receiptText}
                  onChangeText={setReceiptText}
                  placeholder="Incolla qui il testo letto dallo scontrino"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  textAlignVertical="top"
                />
              </Panel>

              <FormField label="Data" value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
              <FormField label="Odometro (km) *" value={odometer} onChange={setOdometer} placeholder="12450" numeric />
              <View style={styles.splitRow}>
                <View style={styles.splitCol}>
                  <FormField label="Litri *" value={liters} onChange={setLiters} placeholder="14.5" decimal />
                </View>
                <View style={styles.splitCol}>
                  <FormField label="Importo (€) *" value={amount} onChange={setAmount} placeholder="29.75" decimal />
                </View>
              </View>
              {ppl ? (
                <View style={styles.priceBox}>
                  <Text style={styles.priceText}>Prezzo litro rilevato: €{ppl}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.toggleRow, fullTank && styles.toggleRowActive]}
                onPress={() => setFullTank((prev) => !prev)}
              >
                <View>
                  <Text style={styles.toggleTitle}>Pieno completo</Text>
                  <Text style={styles.toggleSub}>Attiva per consentire il calcolo corretto del km/l.</Text>
                </View>
                <StatusPill label={fullTank ? 'Si' : 'No'} tone={fullTank ? 'success' : 'default'} />
              </TouchableOpacity>
              <FormField label="Note" value={notes} onChange={setNotes} placeholder="Autogrill A1" />
              <ActionButton label="Salva rifornimento" onPress={handleAdd} loading={saving} />
            </Panel>
          )}

          {refuels.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll}>
              <View style={styles.periodRow}>
                {PERIODS.map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.chip, period === item.value && styles.chipActive]}
                    onPress={() => setPeriod(item.value)}
                  >
                    <Text style={[styles.chipText, period === item.value && styles.chipTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          ) : null}

          {filtered.length === 0 && !showForm ? (
            <Panel title="Nessun rifornimento" subtitle="Tocca il pulsante principale per registrare il primo pieno.">
              <Text style={styles.centerIcon}>⛽</Text>
            </Panel>
          ) : (
            filtered.map((item) => {
              const tone = item.km_per_liter == null ? 'default' : avg && item.km_per_liter >= avg ? 'info' : 'warning'
              return (
                <Panel
                  key={item.id}
                  tone={tone}
                  title={formatDate(item.date)}
                  subtitle={`${item.odometer_km} km · ${item.liters.toFixed(2)} L · ${formatEuro(item.amount_eur)}`}
                >
                  <View style={styles.refuelFooter}>
                    <StatusPill
                      label={item.km_per_liter != null ? `${item.km_per_liter.toFixed(1)} km/l` : 'Parziale'}
                      tone={item.km_per_liter != null ? (avg && item.km_per_liter >= avg ? 'success' : 'warning') : 'default'}
                    />
                    <TouchableOpacity onPress={() => confirmDelete(item.id, deleteRefuel)}>
                      <Text style={styles.deleteText}>Elimina</Text>
                    </TouchableOpacity>
                  </View>
                </Panel>
              )
            })
          )}
        </>
      )}
    </AppScreen>
  )
}

function confirmDelete(id: string, deleteRefuel: (id: string) => Promise<void>) {
  Alert.alert('Elimina rifornimento', 'Sei sicuro?', [
    { text: 'Annulla', style: 'cancel' },
    { text: 'Elimina', style: 'destructive', onPress: () => deleteRefuel(id) },
  ])
}

function filterByPeriod(refuels: Refuel[], period: Period): Refuel[] {
  if (period === 'all') {
    return refuels
  }
  const days = period === '1m' ? 31 : period === '3m' ? 92 : 365
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
  return refuels.filter((item) => item.date >= cutoff)
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  numeric,
  decimal,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  numeric?: boolean
  decimal?: boolean
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={decimal ? 'decimal-pad' : numeric ? 'numeric' : 'default'}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  centerIcon: {
    fontSize: 52,
    textAlign: 'center',
  },
  actionsCol: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  topCtaWrap: {
    marginBottom: spacing.md,
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
    backgroundColor: colors.surfaceDk,
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
  receiptPreview: {
    width: '100%',
    height: 170,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.cardDk,
  },
  receiptInput: {
    minHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardDk,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: font.base,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: font.sm,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.cardDk,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: font.base,
  },
  splitRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  splitCol: {
    flex: 1,
  },
  priceBox: {
    backgroundColor: colors.surfaceDk,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  priceText: {
    color: colors.textPrimary,
    fontSize: font.sm,
    fontWeight: '700',
  },
  toggleRow: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelRaised,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  toggleRowActive: {
    borderColor: colors.successEdge,
  },
  toggleTitle: {
    color: colors.textPrimary,
    fontSize: font.base,
    fontWeight: '700',
  },
  toggleSub: {
    color: colors.textSecondary,
    fontSize: font.sm,
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
  refuelFooter: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteText: {
    color: colors.error,
    fontSize: font.sm,
    fontWeight: '700',
  },
})
