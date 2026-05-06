import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, StyleSheet } from 'react-native'
import { useVehicleStore } from '../../src/store/vehicleStore'
import { useAuthStore } from '../../src/store/authStore'
import { colors, spacing, radius, font } from '../../src/theme'
import type { FuelType } from '../../src/types/vehicle'

const FUEL_TYPES: { value: FuelType; label: string }[] = [
  { value: 'benzina', label: 'Benzina' },
  { value: 'diesel',  label: 'Diesel' },
  { value: 'gpl',     label: 'GPL' },
  { value: 'elettrico', label: 'Elettrico' },
]

export default function GarageScreen() {
  const { user } = useAuthStore()
  const { vehicles, activeVehicle, setActiveVehicle, addVehicle, deleteVehicle } = useVehicleStore()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [brand, setBrand]         = useState('')
  const [model, setModel]         = useState('')
  const [year, setYear]           = useState('')
  const [tank, setTank]           = useState('')
  const [odometer, setOdometer]   = useState('')
  const [fuel, setFuel]           = useState<FuelType>('benzina')
  const [nickname, setNickname]   = useState('')
  const [cc, setCc]               = useState('')

  async function handleAdd() {
    if (!brand.trim() || !model.trim() || !year || !tank || !odometer) {
      Alert.alert('Campi mancanti', 'Compila marca, modello, anno, serbatoio e odometro.')
      return
    }
    if (!user?.id) return
    setSaving(true)
    await addVehicle({
      user_id: user.id, brand: brand.trim(), model: model.trim(),
      year: parseInt(year), tank_capacity_l: parseFloat(tank.replace(',', '.')),
      odometer_start_km: parseInt(odometer), fuel_type: fuel,
      nickname: nickname.trim() || undefined,
      displacement_cc: cc ? parseInt(cc) : undefined,
      is_active: true,
    })
    setSaving(false)
    setShowForm(false)
    setBrand(''); setModel(''); setYear(''); setTank('')
    setOdometer(''); setNickname(''); setCc(''); setFuel('benzina')
  }

  function handleDelete(id: string, name: string) {
    Alert.alert('Elimina', `Eliminare ${name}? Tutti i dati associati saranno rimossi.`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => deleteVehicle(id) },
    ])
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.title}>Garage</Text>
        <TouchableOpacity style={s.btn} onPress={() => setShowForm(!showForm)}>
          <Text style={s.btnText}>{showForm ? 'Annulla' : '+ Aggiungi'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={s.form}>
          <Text style={s.formTitle}>Nuova moto</Text>
          <Field label="Marca *" value={brand} onChange={setBrand} placeholder="es. Fantic" />
          <Field label="Modello *" value={model} onChange={setModel} placeholder="es. Caballero 700" />
          <Field label="Anno *" value={year} onChange={setYear} placeholder="es. 2023" numeric />
          <Field label="Serbatoio (L) *" value={tank} onChange={setTank} placeholder="es. 13.5" decimal />
          <View style={{ marginBottom: spacing.md }}>
            <Text style={s.label}>Odometro (km) *</Text>
            <TextInput style={s.input} value={odometer} onChangeText={setOdometer}
              placeholder="es. 1250" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
            <Text style={s.hint}>ℹ️ Inserisci il valore del contachilometri principale, non il trip parziale.</Text>
          </View>
          <Field label="Cilindrata (cc)" value={cc} onChange={setCc} placeholder="es. 700" numeric />
          <Field label="Soprannome" value={nickname} onChange={setNickname} placeholder="es. La Bestia" />

          <Text style={s.label}>Tipo carburante</Text>
          <View style={s.fuelRow}>
            {FUEL_TYPES.map(ft => (
              <TouchableOpacity key={ft.value}
                style={[s.chip, fuel === ft.value && s.chipActive]}
                onPress={() => setFuel(ft.value)}
              >
                <Text style={{ color: fuel === ft.value ? '#fff' : colors.textSecondary, fontSize: font.sm }}>
                  {ft.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={[s.btn, { marginTop: spacing.sm }]} onPress={handleAdd} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Salva moto</Text>}
          </TouchableOpacity>
        </View>
      )}

      {vehicles.length === 0 && !showForm ? (
        <View style={s.center}>
          <Text style={{ fontSize: 56, marginBottom: spacing.md }}>🏍️</Text>
          <Text style={s.emptyTitle}>Nessuna moto</Text>
          <Text style={s.emptyText}>Aggiungi la tua prima moto per iniziare.</Text>
        </View>
      ) : (
        vehicles.map(v => (
          <TouchableOpacity key={v.id}
            style={[s.vehicleCard, activeVehicle?.id === v.id && s.vehicleCardActive]}
            onPress={() => setActiveVehicle(v)}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.vehicleName}>{v.nickname ?? `${v.brand} ${v.model}`}</Text>
              {v.nickname && <Text style={s.vehicleSub}>{v.brand} {v.model}</Text>}
              <Text style={s.vehicleInfo}>{v.year} · {v.tank_capacity_l}L · {v.fuel_type}</Text>
              <Text style={s.vehicleInfo}>Odometro: {v.odometer_start_km.toLocaleString('it-IT')} km</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: spacing.sm }}>
              {activeVehicle?.id === v.id && (
                <View style={s.activeBadge}><Text style={{ color: colors.primary, fontSize: font.sm }}>Attiva</Text></View>
              )}
              <TouchableOpacity onPress={() => handleDelete(v.id, v.nickname ?? `${v.brand} ${v.model}`)}>
                <Text style={{ color: colors.error, fontSize: font.sm }}>Elimina</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  )
}

function Field({ label, value, onChange, placeholder, numeric, decimal }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; numeric?: boolean; decimal?: boolean
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} value={value} onChangeText={onChange}
        placeholder={placeholder} placeholderTextColor={colors.textMuted}
        keyboardType={decimal ? 'decimal-pad' : numeric ? 'numeric' : 'default'} />
    </View>
  )
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: colors.bgDark },
  content:         { padding: spacing.md, paddingTop: 56, paddingBottom: spacing.xl },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  title:           { fontSize: font.xxl, fontWeight: 'bold', color: colors.textPrimary },
  form:            { backgroundColor: colors.surfaceDk, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg },
  formTitle:       { fontSize: font.lg, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md },
  label:           { fontSize: font.sm, color: colors.textSecondary, marginBottom: 4 },
  input:           { backgroundColor: colors.cardDk, color: colors.textPrimary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: font.base },
  hint:            { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  fuelRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip:            { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  chipActive:      { backgroundColor: colors.primary, borderColor: colors.primary },
  btn:             { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  btnText:         { color: '#fff', fontWeight: '600', fontSize: font.base },
  center:          { alignItems: 'center', paddingVertical: spacing.xl },
  emptyTitle:      { fontSize: font.lg, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  emptyText:       { fontSize: font.md, color: colors.textSecondary, textAlign: 'center' },
  vehicleCard:     { backgroundColor: colors.surfaceDk, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', borderWidth: 2, borderColor: 'transparent' },
  vehicleCardActive:{ borderColor: colors.primary },
  vehicleName:     { fontSize: font.lg, fontWeight: 'bold', color: colors.textPrimary },
  vehicleSub:      { fontSize: font.sm, color: colors.textSecondary },
  vehicleInfo:     { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  activeBadge:     { backgroundColor: 'rgba(232,97,26,0.15)', borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
})
