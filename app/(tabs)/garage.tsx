import { useEffect, useState } from 'react'
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { ActionButton } from '../../src/components/ui/ActionButton'
import { AppScreen } from '../../src/components/ui/AppScreen'
import { Panel } from '../../src/components/ui/Panel'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { StatusPill } from '../../src/components/ui/StatusPill'
import { getVehicleImageUri, removeVehicleImageUri, setVehicleImageUri } from '../../src/services/vehicleImageStore'
import { useAuthStore } from '../../src/store/authStore'
import { useVehicleStore } from '../../src/store/vehicleStore'
import { colors, font, radius, spacing } from '../../src/theme'
import type { FuelType } from '../../src/types/vehicle'

const FUEL_TYPES: { value: FuelType; label: string }[] = [
  { value: 'benzina', label: 'Benzina' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'gpl', label: 'GPL' },
  { value: 'elettrico', label: 'Elettrico' },
]

export default function GarageScreen() {
  const { user } = useAuthStore()
  const { vehicles, activeVehicle, setActiveVehicle, addVehicle, deleteVehicle } = useVehicleStore()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [tank, setTank] = useState('')
  const [odometer, setOdometer] = useState('')
  const [fuel, setFuel] = useState<FuelType>('benzina')
  const [nickname, setNickname] = useState('')
  const [cc, setCc] = useState('')
  const [activeVehicleImageUri, setActiveVehicleImage] = useState<string | null>(null)
  const [pickingImage, setPickingImage] = useState(false)

  useEffect(() => {
    if (!activeVehicle?.id) {
      setActiveVehicleImage(null)
      return
    }

    getVehicleImageUri(activeVehicle.id)
      .then(setActiveVehicleImage)
      .catch((error) => {
        console.error('[garage] load vehicle image:', error)
        setActiveVehicleImage(null)
      })
  }, [activeVehicle?.id])

  async function handleAdd() {
    if (!brand.trim() || !model.trim() || !year || !tank || !odometer) {
      Alert.alert('Campi mancanti', 'Compila marca, modello, anno, serbatoio e odometro.')
      return
    }
    if (!user?.id) {
      return
    }

    setSaving(true)
    await addVehicle({
      user_id: user.id,
      brand: brand.trim(),
      model: model.trim(),
      year: Number.parseInt(year, 10),
      tank_capacity_l: Number.parseFloat(tank.replace(',', '.')),
      odometer_start_km: Number.parseInt(odometer, 10),
      fuel_type: fuel,
      nickname: nickname.trim() || undefined,
      displacement_cc: cc ? Number.parseInt(cc, 10) : undefined,
      is_active: true,
    })
    setSaving(false)
    setShowForm(false)
    setBrand('')
    setModel('')
    setYear('')
    setTank('')
    setOdometer('')
    setNickname('')
    setCc('')
    setFuel('benzina')
  }

  function handleDelete(id: string, name: string) {
    Alert.alert('Elimina veicolo', `Eliminare ${name}? Tutti i dati associati saranno rimossi.`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => deleteVehicle(id) },
    ])
  }

  async function handlePickVehicleImage() {
    if (!activeVehicle?.id) {
      Alert.alert('Veicolo richiesto', 'Seleziona prima una moto attiva.')
      return
    }

    try {
      setPickingImage(true)
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Permesso richiesto', 'Serve accesso alla galleria per scegliere una foto della moto.')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      })

      if (!result.canceled) {
        const uri = result.assets[0]?.uri
        if (uri) {
          await setVehicleImageUri(activeVehicle.id, uri)
          setActiveVehicleImage(uri)
        }
      }
    } catch (error) {
      console.error('[garage] pick vehicle image:', error)
      Alert.alert('Errore', 'Impossibile caricare la foto della moto.')
    } finally {
      setPickingImage(false)
    }
  }

  async function handleRemoveVehicleImage() {
    if (!activeVehicle?.id) {
      return
    }

    await removeVehicleImageUri(activeVehicle.id)
    setActiveVehicleImage(null)
  }

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Garage"
        title="Le tue moto"
        subtitle="Profili tecnici, moto attiva e dati base in un layout piu fotografico e ordinato."
      />

      <View style={styles.topCtaWrap}>
        <ActionButton
          label={showForm ? 'Chiudi inserimento' : 'Aggiungi moto'}
          variant={showForm ? 'secondary' : 'primary'}
          onPress={() => setShowForm((prev) => !prev)}
        />
      </View>

      {activeVehicle ? (
        <Panel
          tone="hero"
          title={activeVehicle.nickname ?? `${activeVehicle.brand} ${activeVehicle.model}`}
          subtitle="Foto moto, stato veicolo e profilo tecnico rapido."
        >
          <View style={styles.activeHero}>
            {activeVehicleImageUri ? (
              <Image source={{ uri: activeVehicleImageUri }} style={styles.vehiclePhoto} />
            ) : (
              <View style={styles.vehiclePhotoPlaceholder}>
                <Text style={styles.vehiclePhotoEmoji}>🏍️</Text>
                <Text style={styles.vehiclePhotoText}>Aggiungi foto</Text>
              </View>
            )}
            <View style={styles.activeHeroMeta}>
              <StatusPill label="Moto attiva" tone="success" />
              <Text style={styles.activeHeroTitle}>{activeVehicle.brand} {activeVehicle.model}</Text>
              <Text style={styles.activeHeroSub}>{activeVehicle.year} · {activeVehicle.tank_capacity_l.toFixed(1)} L · {activeVehicle.fuel_type}</Text>
              <Text style={styles.activeHeroSub}>{activeVehicle.odometer_start_km.toLocaleString('it-IT')} km base</Text>
            </View>
          </View>
          <View style={styles.actionsCol}>
            <ActionButton
              label={activeVehicleImageUri ? 'Cambia foto moto' : 'Carica foto moto'}
              variant="secondary"
              onPress={() => { void handlePickVehicleImage() }}
              loading={pickingImage}
            />
            {activeVehicleImageUri ? (
              <ActionButton label="Rimuovi foto moto" variant="danger" onPress={() => { void handleRemoveVehicleImage() }} />
            ) : null}
          </View>
        </Panel>
      ) : null}

      {showForm && (
        <Panel
          title="Nuovo profilo veicolo"
          subtitle="Usa il contachilometri principale, non il trip parziale. I dati qui diventano la base di dashboard, consumi e viaggi."
          tone="hero"
        >
          <FormField label="Marca *" value={brand} onChange={setBrand} placeholder="es. Fantic" />
          <FormField label="Modello *" value={model} onChange={setModel} placeholder="es. Caballero 700" />
          <View style={styles.splitRow}>
            <View style={styles.splitCol}>
              <FormField label="Anno *" value={year} onChange={setYear} placeholder="2024" numeric />
            </View>
            <View style={styles.splitCol}>
              <FormField label="Serbatoio (L) *" value={tank} onChange={setTank} placeholder="13.5" decimal />
            </View>
          </View>
          <FormField label="Odometro *" value={odometer} onChange={setOdometer} placeholder="1250" numeric />
          <Text style={styles.hint}>Inserisci il contachilometri totale della moto.</Text>
          <View style={styles.splitRow}>
            <View style={styles.splitCol}>
              <FormField label="Cilindrata" value={cc} onChange={setCc} placeholder="700" numeric />
            </View>
            <View style={styles.splitCol}>
              <FormField label="Soprannome" value={nickname} onChange={setNickname} placeholder="La Bestia" />
            </View>
          </View>

          <Text style={styles.sectionLabel}>Tipo carburante</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fuelScroll}>
            <View style={styles.chipsRow}>
              {FUEL_TYPES.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.chip, fuel === item.value && styles.chipActive]}
                  onPress={() => setFuel(item.value)}
                >
                  <Text style={[styles.chipText, fuel === item.value && styles.chipTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <ActionButton
            label="Salva moto"
            onPress={handleAdd}
            loading={saving}
            icon={saving ? undefined : <Text style={styles.icon}>＋</Text>}
          />
        </Panel>
      )}

      {vehicles.length === 0 && !showForm ? (
        <Panel title="Garage vuoto" subtitle="Aggiungi la prima moto per attivare dashboard, rifornimenti e manutenzione.">
          <Text style={styles.emptyIcon}>🏍️</Text>
        </Panel>
      ) : (
        vehicles.map((vehicle) => {
          const isActive = activeVehicle?.id === vehicle.id
          return (
            <TouchableOpacity key={vehicle.id} onPress={() => setActiveVehicle(vehicle)}>
              <Panel
                tone={isActive ? 'hero' : 'default'}
                title={vehicle.nickname ?? `${vehicle.brand} ${vehicle.model}`}
                subtitle={`${vehicle.brand} ${vehicle.model} · ${vehicle.year}`}
              >
                <View style={styles.vehicleHeader}>
                  <View style={styles.vehicleFacts}>
                    <Text style={styles.vehicleStat}>{vehicle.tank_capacity_l} L</Text>
                    <Text style={styles.vehicleMeta}>serbatoio</Text>
                  </View>
                  <View style={styles.vehicleFacts}>
                    <Text style={styles.vehicleStat}>{vehicle.odometer_start_km.toLocaleString('it-IT')}</Text>
                    <Text style={styles.vehicleMeta}>km base</Text>
                  </View>
                  <View style={styles.vehicleFacts}>
                    <Text style={styles.vehicleStat}>{vehicle.fuel_type}</Text>
                    <Text style={styles.vehicleMeta}>fuel</Text>
                  </View>
                </View>
                <View style={styles.vehicleFooter}>
                  <StatusPill label={isActive ? 'Moto attiva' : 'Disponibile'} tone={isActive ? 'success' : 'default'} />
                  <TouchableOpacity onPress={() => handleDelete(vehicle.id, vehicle.nickname ?? `${vehicle.brand} ${vehicle.model}`)}>
                    <Text style={styles.deleteText}>Elimina</Text>
                  </TouchableOpacity>
                </View>
              </Panel>
            </TouchableOpacity>
          )
        })
      )}
    </AppScreen>
  )
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
  icon: {
    color: '#fff',
    fontSize: font.base,
    fontWeight: '700',
  },
  activeHero: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  activeHeroMeta: {
    flex: 1,
    gap: 6,
    justifyContent: 'center',
  },
  activeHeroTitle: {
    color: colors.textPrimary,
    fontSize: font.xl,
    fontWeight: '800',
  },
  activeHeroSub: {
    color: colors.textSecondary,
    fontSize: font.sm,
  },
  vehiclePhoto: {
    width: 112,
    height: 112,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceDk,
  },
  vehiclePhotoPlaceholder: {
    width: 112,
    height: 112,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceDk,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  vehiclePhotoEmoji: {
    fontSize: 34,
  },
  vehiclePhotoText: {
    color: colors.textMuted,
    fontSize: font.sm,
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
  sectionLabel: {
    color: colors.accentSoft,
    fontSize: font.sm,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  fuelScroll: {
    marginBottom: spacing.md,
  },
  actionsCol: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  topCtaWrap: {
    marginBottom: spacing.md,
  },
  chipsRow: {
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
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  hint: {
    color: colors.textMuted,
    fontSize: font.sm,
    marginTop: -4,
    marginBottom: spacing.md,
  },
  emptyIcon: {
    fontSize: 56,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  vehicleHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  vehicleFacts: {
    flex: 1,
    backgroundColor: colors.surfaceDk,
    borderRadius: radius.lg,
    padding: spacing.sm + 4,
  },
  vehicleStat: {
    color: colors.textPrimary,
    fontSize: font.lg,
    fontWeight: '800',
  },
  vehicleMeta: {
    color: colors.textMuted,
    fontSize: font.sm,
    marginTop: 3,
  },
  vehicleFooter: {
    marginTop: spacing.md,
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
