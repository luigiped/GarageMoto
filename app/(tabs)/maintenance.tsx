import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, StyleSheet } from 'react-native'
import { useMaintenanceStore } from '../../src/store/maintenanceStore'
import { useVehicleStore } from '../../src/store/vehicleStore'
import { useRefuelStore } from '../../src/store/refuelStore'
import { useAuthStore } from '../../src/store/authStore'
import { getStatus, kmUntilDue, daysUntilDue } from '../../src/utils/maintenanceChecker'
import { MAINTENANCE_LABELS, MAINTENANCE_ICONS, type MaintenanceType } from '../../src/types/maintenance'
import { colors, spacing, radius, font } from '../../src/theme'

const TYPES = Object.entries(MAINTENANCE_LABELS) as [MaintenanceType, string][]

export default function MaintenanceScreen() {
  const { user } = useAuthStore()
  const { activeVehicle } = useVehicleStore()
  const { refuels } = useRefuelStore()
  const { items, loadMaintenance, addMaintenance, deleteMaintenance } = useMaintenanceStore()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [type, setType]               = useState<MaintenanceType>('oil_change')
  const [label, setLabel]             = useState('')
  const [lastDate, setLastDate]       = useState('')
  const [lastKm, setLastKm]           = useState('')
  const [intervalKm, setIntervalKm]   = useState('')
  const [intervalMonths, setIM]       = useState('')

  const currentKm = refuels[0]?.odometer_km ?? activeVehicle?.odometer_start_km ?? 0

  useEffect(() => { if (activeVehicle?.id) loadMaintenance(activeVehicle.id) }, [activeVehicle?.id])

  async function handleAdd() {
    if (!intervalKm && !intervalMonths) { Alert.alert('Errore', 'Inserisci almeno un intervallo (km o mesi).'); return }
    if (type === 'custom' && !label.trim()) { Alert.alert('Errore', 'Inserisci una descrizione.'); return }
    if (!activeVehicle || !user?.id) return
    setSaving(true)
    await addMaintenance({
      user_id: user.id, vehicle_id: activeVehicle.id, type,
      label: type === 'custom' ? label.trim() : undefined,
      last_date: lastDate || undefined, last_km: lastKm ? parseInt(lastKm) : undefined,
      interval_km: intervalKm ? parseInt(intervalKm) : undefined,
      interval_months: intervalMonths ? parseInt(intervalMonths) : undefined,
    }, currentKm)
    setSaving(false); setShowForm(false)
    setLabel(''); setLastDate(''); setLastKm(''); setIntervalKm(''); setIM(''); setType('oil_change')
    Alert.alert('✅', 'Intervento salvato!')
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.title}>Manutenzione</Text>
        <TouchableOpacity style={s.btn} onPress={() => setShowForm(!showForm)}>
          <Text style={s.btnText}>{showForm ? 'Annulla' : '+ Aggiungi'}</Text>
        </TouchableOpacity>
      </View>

      {!activeVehicle && <Text style={s.noVehicle}>Seleziona prima un veicolo dal Garage.</Text>}

      {showForm && activeVehicle && (
        <View style={s.form}>
          <Text style={s.formTitle}>Nuovo intervento</Text>
          <Text style={s.label}>Tipo intervento</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {TYPES.map(([t, l]) => (
                <TouchableOpacity key={t} style={[s.chip, type === t && s.chipActive]} onPress={() => setType(t)}>
                  <Text style={{ color: type === t ? '#fff' : colors.textSecondary, fontSize: font.sm }}>
                    {MAINTENANCE_ICONS[t]} {l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          {type === 'custom' && <><Text style={s.label}>Descrizione *</Text>
            <TextInput style={[s.input, { marginBottom: spacing.sm }]} value={label} onChangeText={setLabel} placeholder="es. Sostituzione pastiglie" placeholderTextColor={colors.textMuted} /></>}
          <Text style={s.label}>Data ultimo intervento</Text>
          <TextInput style={[s.input, { marginBottom: spacing.sm }]} value={lastDate} onChangeText={setLastDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
          <Text style={s.label}>Km ultimo intervento</Text>
          <TextInput style={[s.input, { marginBottom: spacing.sm }]} value={lastKm} onChangeText={setLastKm} placeholder="es. 12000" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Intervallo (km)</Text>
              <TextInput style={s.input} value={intervalKm} onChangeText={setIntervalKm} placeholder="es. 5000" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Intervallo (mesi)</Text>
              <TextInput style={s.input} value={intervalMonths} onChangeText={setIM} placeholder="es. 12" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
            </View>
          </View>
          <TouchableOpacity style={s.btn} onPress={handleAdd} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Salva intervento</Text>}
          </TouchableOpacity>
        </View>
      )}

      {items.length === 0 && !showForm ? (
        <View style={s.center}>
          <Text style={{ fontSize: 48, marginBottom: spacing.md }}>🔧</Text>
          <Text style={s.emptyTitle}>Nessun intervento</Text>
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>Aggiungi le scadenze di manutenzione.</Text>
        </View>
      ) : (
        items.map(item => {
          const status = getStatus(item, currentKm)
          const kmLeft = kmUntilDue(item, currentKm)
          const dLeft  = daysUntilDue(item)
          const displayLabel = item.label ?? MAINTENANCE_LABELS[item.type]
          const statusColor = status === 'overdue' ? colors.error : status === 'warning' ? colors.warning : colors.success
          const statusLabel = status === 'overdue' ? 'Scaduto' : status === 'warning' ? 'In scadenza' : 'OK'
          return (
            <View key={item.id} style={[s.card, { borderColor: status !== 'ok' ? statusColor : 'transparent' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: font.base, color: colors.textPrimary, fontWeight: '600', flex: 1 }}>
                  {MAINTENANCE_ICONS[item.type]} {displayLabel}
                </Text>
                <View style={[s.badge, { backgroundColor: `${statusColor}22` }]}>
                  <Text style={{ color: statusColor, fontSize: font.sm, fontWeight: '500' }}>{statusLabel}</Text>
                </View>
              </View>
              {kmLeft != null && (
                <Text style={s.cardInfo}>{kmLeft > 0 ? `${kmLeft} km al prossimo` : `${Math.abs(kmLeft)} km oltre la scadenza`}</Text>
              )}
              {dLeft != null && (
                <Text style={s.cardInfo}>{dLeft > 0 ? `${dLeft} giorni alla scadenza` : `Scaduto da ${Math.abs(dLeft)} giorni`}</Text>
              )}
              <TouchableOpacity style={{ alignSelf: 'flex-end', marginTop: spacing.sm }}
                onPress={() => Alert.alert('Elimina', `Eliminare "${displayLabel}"?`, [
                  { text: 'Annulla', style: 'cancel' },
                  { text: 'Elimina', style: 'destructive', onPress: () => deleteMaintenance(item.id) },
                ])}>
                <Text style={{ color: colors.error, fontSize: font.sm }}>Elimina</Text>
              </TouchableOpacity>
            </View>
          )
        })
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: colors.bgDark },
  content:   { padding: spacing.md, paddingTop: 56, paddingBottom: spacing.xl },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  title:     { fontSize: font.xxl, fontWeight: 'bold', color: colors.textPrimary },
  noVehicle: { color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.xl },
  form:      { backgroundColor: colors.surfaceDk, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg },
  formTitle: { fontSize: font.lg, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md },
  label:     { fontSize: font.sm, color: colors.textSecondary, marginBottom: 4 },
  input:     { backgroundColor: colors.cardDk, color: colors.textPrimary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: font.base },
  chip:      { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  chipActive:{ backgroundColor: colors.primary, borderColor: colors.primary },
  btn:       { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  btnText:   { color: '#fff', fontWeight: '600', fontSize: font.base },
  center:    { alignItems: 'center', paddingVertical: spacing.xl },
  emptyTitle:{ fontSize: font.lg, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  card:      { backgroundColor: colors.surfaceDk, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 2 },
  badge:     { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2, marginLeft: spacing.sm },
  cardInfo:  { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
})
