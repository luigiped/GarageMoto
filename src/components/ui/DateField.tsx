import { useMemo, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { formatDate, todayISO } from '../../utils/formatters'
import { useTheme } from '../../useTheme'

type DateFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

type CalendarDay = {
  iso: string
  day: number
  currentMonth: boolean
}

const WEEK_DAYS = ['L', 'Ma', 'Me', 'G', 'V', 'S', 'D']
const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Seleziona una data',
}: DateFieldProps) {
  const theme = useTheme()
  const styles = createStyles(theme)
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => parseIsoToDate(value || todayISO()))

  const selected = value ? parseIsoToDate(value) : null
  const selectedLabel = value ? formatDate(value) : placeholder
  const days = useMemo(() => buildCalendarDays(viewDate), [viewDate])

  function openCalendar() {
    setViewDate(parseIsoToDate(value || todayISO()))
    setOpen(true)
  }

  function handleSelect(iso: string) {
    setOpen(false)
    onChange(iso)
  }

  function shiftMonth(direction: -1 | 1) {
    const next = new Date(viewDate)
    next.setMonth(next.getMonth() + direction)
    setViewDate(next)
  }

  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity style={styles.trigger} onPress={openCalendar} activeOpacity={0.9}>
          <Text style={[styles.triggerText, !value && styles.placeholderText]}>{selectedLabel}</Text>
          <Text style={styles.chevron}>📅</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalCard}>
            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.navBtn} onPress={() => shiftMonth(-1)}>
                <Text style={styles.navBtnText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
              </Text>
              <TouchableOpacity style={styles.navBtn} onPress={() => shiftMonth(1)}>
                <Text style={styles.navBtnText}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEK_DAYS.map((day, index) => (
                <Text key={`${day}-${index}`} style={styles.weekDay}>{day}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {days.map((day) => {
                const isSelected = selected ? sameIso(selected, day.iso) : false
                return (
                  <TouchableOpacity
                    key={day.iso}
                    style={[styles.dayCell, !day.currentMonth && styles.dayCellMuted, isSelected && styles.dayCellActive]}
                    onPress={() => handleSelect(day.iso)}
                  >
                    <Text style={[styles.dayText, !day.currentMonth && styles.dayTextMuted, isSelected && styles.dayTextActive]}>
                      {day.day}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setOpen(false)}>
                <Text style={styles.secondaryBtnText}>Chiudi</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => handleSelect(todayISO())}
              >
                <Text style={styles.primaryBtnText}>Oggi</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

function parseIsoToDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toIso(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function sameIso(date: Date, iso: string) {
  return toIso(date) === iso
}

function buildCalendarDays(baseDate: Date): CalendarDay[] {
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const mondayBasedStart = (firstDay.getDay() + 6) % 7
  const days: CalendarDay[] = []

  for (let index = mondayBasedStart; index > 0; index -= 1) {
    const date = new Date(year, month, 1 - index)
    days.push({ iso: toIso(date), day: date.getDate(), currentMonth: false })
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = new Date(year, month, day)
    days.push({ iso: toIso(date), day, currentMonth: true })
  }

  while (days.length % 7 !== 0) {
    const date = new Date(year, month, lastDay.getDate() + (days.length % 7))
    days.push({ iso: toIso(date), day: date.getDate(), currentMonth: false })
  }

  return days
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  const { colors, font, radius, spacing } = theme

  return StyleSheet.create({
    field: {
      marginBottom: spacing.md,
    },
    label: {
      color: colors.textSecondary,
      fontSize: font.sm,
      marginBottom: 6,
    },
    trigger: {
      minHeight: 52,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardDk,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    triggerText: {
      color: colors.textPrimary,
      fontSize: font.base,
      flex: 1,
      paddingRight: spacing.sm,
    },
    placeholderText: {
      color: colors.textMuted,
    },
    chevron: {
      fontSize: font.base,
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    modalCard: {
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.bgElevated,
      padding: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    navBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceDk,
      borderWidth: 1,
      borderColor: colors.border,
    },
    navBtnText: {
      color: colors.textPrimary,
      fontSize: font.lg,
      fontWeight: '800',
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: font.lg,
      fontWeight: '800',
    },
    weekRow: {
      flexDirection: 'row',
      marginBottom: spacing.sm,
    },
    weekDay: {
      flex: 1,
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: font.sm,
      fontWeight: '700',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    dayCell: {
      width: '13.2%',
      aspectRatio: 1,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceDk,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dayCellMuted: {
      opacity: 0.45,
    },
    dayCellActive: {
      backgroundColor: colors.heroSurface,
      borderColor: colors.heroEdge,
    },
    dayText: {
      color: colors.textPrimary,
      fontSize: font.base,
      fontWeight: '600',
    },
    dayTextMuted: {
      color: colors.textMuted,
    },
    dayTextActive: {
      color: colors.primary,
      fontWeight: '800',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    secondaryBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceDk,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryBtnText: {
      color: colors.textPrimary,
      fontSize: font.base,
      fontWeight: '700',
    },
    primaryBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: {
      color: '#fff',
      fontSize: font.base,
      fontWeight: '700',
    },
  })
}
