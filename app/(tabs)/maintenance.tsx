import { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { ActionButton } from '../../src/components/ui/ActionButton'
import { AppScreen } from '../../src/components/ui/AppScreen'
import { DateField } from '../../src/components/ui/DateField'
import { Panel } from '../../src/components/ui/Panel'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { SelectField } from '../../src/components/ui/SelectField'
import { StatusPill } from '../../src/components/ui/StatusPill'
import { useAuthStore } from '../../src/store/authStore'
import { useMaintenanceStore } from '../../src/store/maintenanceStore'
import { useRefuelStore } from '../../src/store/refuelStore'
import { useVehicleStore } from '../../src/store/vehicleStore'
import { useTheme } from '../../src/useTheme'
import { MAINTENANCE_ICONS, MAINTENANCE_LABELS, type MaintenanceType } from '../../src/types/maintenance'
import { daysUntilDue, getStatus, kmUntilDue } from '../../src/utils/maintenanceChecker'

const TYPES = Object.entries(MAINTENANCE_LABELS) as [MaintenanceType, string][]

export default function MaintenanceScreen() {
  const theme = useTheme()
  const styles = createStyles(theme)
  const { colors, designPreset } = theme
  const { user } = useAuthStore()
  const { activeVehicle } = useVehicleStore()
  const { refuels } = useRefuelStore()
  const { items, loadMaintenance, addMaintenance, deleteMaintenance } = useMaintenanceStore()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [type, setType] = useState<MaintenanceType>('oil_change')
  const [label, setLabel] = useState('')
  const [lastDate, setLastDate] = useState('')
  const [lastKm, setLastKm] = useState('')
  const [intervalKm, setIntervalKm] = useState('')
  const [intervalMonths, setIntervalMonths] = useState('')

  const currentKm = refuels[0]?.odometer_km ?? activeVehicle?.odometer_start_km ?? 0
  const overdueCount = items.filter((item) => getStatus(item, currentKm) === 'overdue').length
  const warningCount = items.filter((item) => getStatus(item, currentKm) === 'warning').length
  const okCount = items.filter((item) => getStatus(item, currentKm) === 'ok').length
  const nextItem = items[0]

  useEffect(() => {
    if (activeVehicle?.id) {
      loadMaintenance(activeVehicle.id)
    }
  }, [activeVehicle?.id, loadMaintenance])

  async function handleAdd() {
    if (!intervalKm && !intervalMonths) {
      Alert.alert('Errore', 'Inserisci almeno un intervallo in km o in mesi.')
      return
    }
    if (type === 'custom' && !label.trim()) {
      Alert.alert('Errore', 'Per il tipo personalizzato serve una descrizione.')
      return
    }
    if (!activeVehicle || !user?.id) {
      return
    }

    setSaving(true)
    await addMaintenance({
      user_id: user.id,
      vehicle_id: activeVehicle.id,
      type,
      label: type === 'custom' ? label.trim() : undefined,
      last_date: lastDate || undefined,
      last_km: lastKm ? Number.parseInt(lastKm, 10) : undefined,
      interval_km: intervalKm ? Number.parseInt(intervalKm, 10) : undefined,
      interval_months: intervalMonths ? Number.parseInt(intervalMonths, 10) : undefined,
    }, currentKm)
    setSaving(false)
    setShowForm(false)
    setType('oil_change')
    setLabel('')
    setLastDate('')
    setLastKm('')
    setIntervalKm('')
    setIntervalMonths('')
    Alert.alert('Intervento salvato', 'La scadenza e ora monitorata nel cruscotto.')
  }

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Service"
        title="Manutenzione"
        subtitle="Scadenze, priorita e prossimo service in una vista piu tecnica."
      />

      {!activeVehicle ? (
        <Panel title="Veicolo richiesto" subtitle="Seleziona prima una moto dal Garage per associare gli interventi di manutenzione.">
          <Text style={styles.centerIcon}>🔧</Text>
        </Panel>
      ) : (
        <>
          {designPreset === 'glass' ? (
            <Panel
              tone="default"
              title={`${activeVehicle.brand} ${activeVehicle.model}`}
              subtitle={nextItem ? `Prossimo focus: ${nextItem.label ?? MAINTENANCE_LABELS[nextItem.type]}` : 'Nessuna scadenza ancora registrata.'}
            >
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryValue}>{overdueCount}</Text>
                  <Text style={styles.summaryLabel}>scaduti</Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryValue}>{warningCount}</Text>
                  <Text style={styles.summaryLabel}>warning</Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryValue}>{okCount}</Text>
                  <Text style={styles.summaryLabel}>ok</Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryValue}>{items.length}</Text>
                  <Text style={styles.summaryLabel}>item attivi</Text>
                </View>
              </View>
            </Panel>
          ) : null}

          <View style={styles.topCtaWrap}>
            <ActionButton
              label={showForm ? 'Chiudi inserimento' : 'Aggiungi intervento'}
              variant={showForm ? 'secondary' : 'primary'}
              onPress={() => setShowForm((prev) => !prev)}
            />
          </View>

          {showForm && (
            <Panel
              tone="hero"
              title="Nuova scadenza manutenzione"
              subtitle="Puoi usare intervallo in km, in mesi oppure entrambi."
            >
              <SelectField
                label="Tipo intervento"
                value={type}
                onChange={(nextValue) => setType(nextValue as MaintenanceType)}
                options={TYPES.map(([key, value]) => ({
                  value: key,
                  label: `${MAINTENANCE_ICONS[key]} ${value}`,
                }))}
              />

              {type === 'custom' && (
                <FormField label="Descrizione *" value={label} onChange={setLabel} placeholder="es. Sostituzione pastiglie" />
              )}
              <DateField label="Data ultimo intervento" value={lastDate} onChange={setLastDate} />
              <FormField label="Km ultimo intervento" value={lastKm} onChange={setLastKm} placeholder="12000" numeric />
              <View style={styles.splitRow}>
                <View style={styles.splitCol}>
                  <FormField label="Intervallo km" value={intervalKm} onChange={setIntervalKm} placeholder="5000" numeric />
                </View>
                <View style={styles.splitCol}>
                  <FormField label="Intervallo mesi" value={intervalMonths} onChange={setIntervalMonths} placeholder="12" numeric />
                </View>
              </View>
              <ActionButton label="Salva intervento" onPress={handleAdd} loading={saving} />
            </Panel>
          )}

          {items.length === 0 && !showForm ? (
            <Panel title="Nessuna scadenza registrata" subtitle="Aggiungi il primo intervento per iniziare a ricevere alert e stato service.">
              <Text style={styles.centerIcon}>🧰</Text>
            </Panel>
          ) : (
            items.map((item) => {
              const status = getStatus(item, currentKm)
              const kmLeft = kmUntilDue(item, currentKm)
              const dLeft = daysUntilDue(item)
              const displayLabel = item.label ?? MAINTENANCE_LABELS[item.type]
              const tone = status === 'overdue' ? 'danger' : status === 'warning' ? 'warning' : 'default'

              return (
                <Panel
                  key={item.id}
                  tone={tone}
                  title={`${MAINTENANCE_ICONS[item.type]} ${displayLabel}`}
                  subtitle={buildSubtitle(kmLeft, dLeft)}
                >
                  <View style={styles.itemFooter}>
                    <StatusPill
                      label={status === 'overdue' ? 'Scaduto' : status === 'warning' ? 'In scadenza' : 'OK'}
                      tone={status === 'overdue' ? 'danger' : status === 'warning' ? 'warning' : 'success'}
                    />
                    <TouchableOpacity onPress={() => confirmDelete(item.id, displayLabel, deleteMaintenance)}>
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

function confirmDelete(id: string, label: string, deleteMaintenance: (id: string) => Promise<void>) {
  Alert.alert('Elimina intervento', `Eliminare "${label}"?`, [
    { text: 'Annulla', style: 'cancel' },
    { text: 'Elimina', style: 'destructive', onPress: () => deleteMaintenance(id) },
  ])
}

function buildSubtitle(kmLeft: number | null, dLeft: number | null): string {
  const parts: string[] = []
  if (kmLeft != null) {
    parts.push(kmLeft > 0 ? `${kmLeft} km al prossimo service` : `${Math.abs(kmLeft)} km oltre soglia`)
  }
  if (dLeft != null) {
    parts.push(dLeft > 0 ? `${dLeft} giorni residui` : `scaduto da ${Math.abs(dLeft)} giorni`)
  }
  return parts.join(' · ') || 'Nessuna soglia disponibile'
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  numeric,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  numeric?: boolean
}) {
  const theme = useTheme()
  const styles = createStyles(theme)
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        keyboardType={numeric ? 'numeric' : 'default'}
      />
    </View>
  )
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  const { colors, font, radius, spacing } = theme

  return StyleSheet.create({
  centerIcon: {
    fontSize: 52,
    textAlign: 'center',
  },
  sectionLabel: {
    color: colors.accentSoft,
    fontSize: font.sm,
    marginBottom: spacing.sm,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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
  itemFooter: {
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
}
