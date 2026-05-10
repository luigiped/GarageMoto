import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useState } from 'react'
import { useTheme } from '../../useTheme'

type SelectOption = {
  label: string
  value: string
}

type SelectFieldProps = {
  label: string
  value: string
  options: SelectOption[]
  placeholder?: string
  onChange: (value: string) => void
}

export function SelectField({
  label,
  value,
  options,
  placeholder = 'Seleziona',
  onChange,
}: SelectFieldProps) {
  const theme = useTheme()
  const styles = createStyles(theme)
  const [open, setOpen] = useState(false)

  const selectedLabel = options.find((option) => option.value === value)?.label ?? placeholder

  function handleSelect(nextValue: string) {
    setOpen(false)
    onChange(nextValue)
  }

  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)} activeOpacity={0.9}>
          <Text style={[styles.triggerText, !value && styles.placeholderText]}>{selectedLabel}</Text>
          <Text style={styles.chevron}>▾</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>{label}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.optionsCol}>
                {options.map((option) => {
                  const selected = option.value === value
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.optionRow, selected && styles.optionRowActive]}
                      onPress={() => handleSelect(option.value)}
                    >
                      <Text style={[styles.optionText, selected && styles.optionTextActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
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
      color: colors.textSecondary,
      fontSize: font.base,
      fontWeight: '700',
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    modalCard: {
      maxHeight: '70%',
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.bgElevated,
      padding: spacing.md,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: font.lg,
      fontWeight: '800',
      marginBottom: spacing.md,
    },
    optionsCol: {
      gap: spacing.sm,
    },
    optionRow: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceDk,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
    },
    optionRowActive: {
      borderColor: colors.primaryEdge,
      backgroundColor: colors.heroSurface,
    },
    optionText: {
      color: colors.textPrimary,
      fontSize: font.base,
      fontWeight: '600',
    },
    optionTextActive: {
      color: colors.primary,
    },
  })
}
