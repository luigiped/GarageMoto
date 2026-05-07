import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Switch, ActivityIndicator, StyleSheet, Image } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useRefuelStore } from '../../src/store/refuelStore'
import { useVehicleStore } from '../../src/store/vehicleStore'
import { useAuthStore } from '../../src/store/authStore'
import { averageConsumption } from '../../src/utils/fuelCalculator'
import { parseReceiptText } from '../../src/utils/receiptParser'
import { formatEuro, formatDate, todayISO } from '../../src/utils/formatters'
import { colors, spacing, radius, font } from '../../src/theme'
import type { Refuel } from '../../src/types/refuel'

type Period = 'all' | '1m' | '3m' | '1y'
const PERIODS: { value: Period; label: string }[] = [
  { value: 'all', label: 'Tutto' }, { value: '1m', label: '1 mese' },
  { value: '3m', label: '3 mesi' }, { value: '1y', label: '1 anno' },
]

function filterByPeriod(refuels: Refuel[], period: Period): Refuel[] {
  if (period === 'all') return refuels
  const days = period === '1m' ? 31 : period === '3m' ? 92 : 365
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
  return refuels.filter(r => r.date >= cutoff)
}

export default function RefuelsScreen() {
  const { user } = useAuthStore()
  const { activeVehicle } = useVehicleStore()
  const { refuels, loadRefuels, addRefuel, deleteRefuel } = useRefuelStore()
  const [period, setPeriod] = useState<Period>('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [date, setDate]       = useState(todayISO())
  const [odometer, setOdometer] = useState('')
  const [liters, setLiters]   = useState('')
  const [amount, setAmount]   = useState('')
  const [fullTank, setFullTank] = useState(true)
  const [notes, setNotes]     = useState('')
  const [receiptText, setReceiptText] = useState('')
  const [receiptImageUri, setReceiptImageUri] = useState<string | null>(null)
  const [parsingReceipt, setParsingReceipt] = useState(false)

  const ppl = liters && amount && parseFloat(liters) > 0
    ? (parseFloat(amount.replace(',', '.')) / parseFloat(liters.replace(',', '.'))).toFixed(3) : null

  useEffect(() => { if (activeVehicle?.id) loadRefuels(activeVehicle.id) }, [activeVehicle?.id])

  async function handleAdd() {
    if (!odometer || !liters || !amount) { Alert.alert('Campi mancanti', 'Compila odometro, litri e importo.'); return }
    if (!activeVehicle || !user?.id) return
    setSaving(true)
    const kml = await addRefuel({
      user_id: user.id, vehicle_id: activeVehicle.id, date,
      odometer_km: parseInt(odometer), liters: parseFloat(liters.replace(',', '.')),
      amount_eur: parseFloat(amount.replace(',', '.')), is_full_tank: fullTank,
      notes: notes.trim() || undefined,
    })
    setSaving(false); setShowForm(false)
    setOdometer(''); setLiters(''); setAmount(''); setNotes(''); setDate(todayISO()); setFullTank(true)
    setReceiptText(''); setReceiptImageUri(null)
    Alert.alert('Salvato!', kml ? `km/l: ${kml}` : 'Rifornimento registrato.')
  }

  async function handlePickReceiptImage() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Permesso richiesto', 'Serve accesso alla galleria per allegare uno scontrino.')
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

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.title}>Carburante</Text>
        <TouchableOpacity style={s.btn} onPress={() => setShowForm(!showForm)}>
          <Text style={s.btnText}>{showForm ? 'Annulla' : '+ Aggiungi'}</Text>
        </TouchableOpacity>
      </View>

      {!activeVehicle && <Text style={s.noVehicle}>Seleziona prima un veicolo dal Garage.</Text>}

      {showForm && activeVehicle && (
        <View style={s.form}>
          <Text style={s.formTitle}>Nuovo rifornimento</Text>
          <View style={s.receiptCard}>
            <Text style={s.receiptTitle}>OCR scontrino (beta)</Text>
            <Text style={s.receiptText}>
              Seleziona uno scontrino come riferimento e incolla qui il testo estratto, ad esempio da Google Lens.
            </Text>
            <View style={s.receiptActions}>
              <TouchableOpacity style={s.secondaryBtn} onPress={handlePickReceiptImage}>
                <Text style={s.secondaryBtnText}>{receiptImageUri ? 'Cambia immagine' : 'Seleziona scontrino'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.secondaryBtn} onPress={handleApplyReceiptText} disabled={parsingReceipt}>
                <Text style={s.secondaryBtnText}>{parsingReceipt ? 'Analisi...' : 'Applica testo OCR'}</Text>
              </TouchableOpacity>
            </View>
            {receiptImageUri && <Image source={{ uri: receiptImageUri }} style={s.receiptPreview} />}
            <TextInput
              style={[s.input, s.receiptInput]}
              value={receiptText}
              onChangeText={setReceiptText}
              placeholder="Incolla qui il testo letto dallo scontrino"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
            />
          </View>
          <Label text="Data" />
          <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
          <View style={{ height: spacing.sm }} />
          <Label text="Odometro (km) *" />
          <TextInput style={s.input} value={odometer} onChangeText={setOdometer} placeholder="es. 12450" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
          <View style={{ height: spacing.sm }} />
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Label text="Litri *" />
              <TextInput style={s.input} value={liters} onChangeText={setLiters} placeholder="es. 14.5" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
            </View>
            <View style={{ width: spacing.sm }} />
            <View style={{ flex: 1 }}>
              <Label text="Importo (€) *" />
              <TextInput style={s.input} value={amount} onChangeText={setAmount} placeholder="es. 29.75" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
            </View>
          </View>
          {ppl && (
            <View style={s.pplBox}>
              <Text style={s.pplText}>⚡ Prezzo/litro: €{ppl}</Text>
            </View>
          )}
          <View style={{ height: spacing.sm }} />
          <View style={s.switchRow}>
            <View>
              <Text style={{ color: colors.textPrimary, fontSize: font.base }}>Pieno completo</Text>
              <Text style={{ color: colors.textMuted, fontSize: font.sm }}>Il km/l si calcola solo per i pieni</Text>
            </View>
            <Switch value={fullTank} onValueChange={setFullTank} trackColor={{ true: colors.primary }} thumbColor="#fff" />
          </View>
          <View style={{ height: spacing.sm }} />
          <Label text="Note (opzionale)" />
          <TextInput style={s.input} value={notes} onChangeText={setNotes} placeholder="es. Autogrill A1" placeholderTextColor={colors.textMuted} maxLength={200} />
          <View style={{ height: spacing.md }} />
          <TouchableOpacity style={s.btn} onPress={handleAdd} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Salva rifornimento</Text>}
          </TouchableOpacity>
        </View>
      )}

      {refuels.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {PERIODS.map(p => (
              <TouchableOpacity key={p.value} style={[s.chip, period === p.value && s.chipActive]} onPress={() => setPeriod(p.value)}>
                <Text style={{ color: period === p.value ? '#fff' : colors.textSecondary, fontSize: font.sm }}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {filtered.length === 0 && !showForm ? (
        <View style={s.center}>
          <Text style={{ fontSize: 48, marginBottom: spacing.md }}>⛽</Text>
          <Text style={s.emptyTitle}>Nessun rifornimento</Text>
          <Text style={{ color: colors.textSecondary }}>Tocca + per aggiungere il primo.</Text>
        </View>
      ) : (
        filtered.map(r => {
          const kmlColor = r.km_per_liter == null ? colors.textMuted : avg && r.km_per_liter >= avg ? colors.success : colors.warning
          return (
            <View key={r.id} style={s.refuelCard}>
              <View style={[s.kmlBar, { backgroundColor: kmlColor }]} />
              <View style={{ flex: 1 }}>
                <View style={s.row}>
                  <Text style={s.refuelDate}>{formatDate(r.date)}</Text>
                  <Text style={s.refuelAmount}>{formatEuro(r.amount_eur)}</Text>
                </View>
                <Text style={s.refuelInfo}>
                  {r.odometer_km} km · {r.liters.toFixed(2)} L{r.km_per_liter ? ` · ${r.km_per_liter.toFixed(1)} km/l` : ' · parziale'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => Alert.alert('Elimina', 'Sei sicuro?', [
                { text: 'Annulla', style: 'cancel' },
                { text: 'Elimina', style: 'destructive', onPress: () => deleteRefuel(r.id) },
              ])}>
                <Text style={{ color: colors.error, fontSize: 18, marginLeft: spacing.sm }}>🗑</Text>
              </TouchableOpacity>
            </View>
          )
        })
      )}
    </ScrollView>
  )
}

const Label = ({ text }: { text: string }) => <Text style={{ fontSize: font.sm, color: colors.textSecondary, marginBottom: 4 }}>{text}</Text>

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bgDark },
  content:     { padding: spacing.md, paddingTop: 56, paddingBottom: spacing.xl },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  title:       { fontSize: font.xxl, fontWeight: 'bold', color: colors.textPrimary },
  noVehicle:   { color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.xl },
  form:        { backgroundColor: colors.surfaceDk, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg },
  formTitle:   { fontSize: font.lg, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md },
  input:       { backgroundColor: colors.cardDk, color: colors.textPrimary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: font.base },
  receiptCard: { backgroundColor: colors.cardDk, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  receiptTitle:{ color: colors.textPrimary, fontSize: font.base, fontWeight: '600', marginBottom: 4 },
  receiptText: { color: colors.textSecondary, fontSize: font.sm, lineHeight: 18, marginBottom: spacing.sm },
  receiptActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  secondaryBtn: { flex: 1, backgroundColor: colors.surfaceDk, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  secondaryBtnText: { color: colors.primary, fontSize: font.sm, fontWeight: '600' },
  receiptPreview: { width: '100%', height: 160, borderRadius: radius.md, marginBottom: spacing.sm, backgroundColor: colors.surfaceDk },
  receiptInput: { minHeight: 110, paddingTop: 12 },
  row:         { flexDirection: 'row', alignItems: 'center' },
  switchRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pplBox:      { backgroundColor: 'rgba(232,97,26,0.1)', borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.sm },
  pplText:     { color: colors.primary, fontSize: font.sm },
  btn:         { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  btnText:     { color: '#fff', fontWeight: '600', fontSize: font.base },
  chip:        { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  chipActive:  { backgroundColor: colors.primary, borderColor: colors.primary },
  center:      { alignItems: 'center', paddingVertical: spacing.xl },
  emptyTitle:  { fontSize: font.lg, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  refuelCard:  { backgroundColor: colors.surfaceDk, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center' },
  kmlBar:      { width: 4, height: 48, borderRadius: 2, marginRight: spacing.sm },
  refuelDate:  { fontSize: font.sm, color: colors.textSecondary, flex: 1 },
  refuelAmount:{ fontSize: font.base, fontWeight: '600', color: colors.textPrimary },
  refuelInfo:  { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
})
