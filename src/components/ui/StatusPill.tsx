import { StyleSheet, Text, View } from 'react-native'
import { colors, font, radius, spacing } from '../../theme'

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info'

export function StatusPill({
  label,
  tone = 'default',
}: {
  label: string
  tone?: Tone
}) {
  return (
    <View style={[styles.pill, pillStyles[tone]]}>
      <Text style={[styles.label, labelStyles[tone]]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
  },
  label: {
    fontSize: font.sm,
    fontWeight: '700',
  },
})

const pillStyles = StyleSheet.create({
  default: {
    backgroundColor: colors.panelRaised,
    borderColor: colors.borderStrong,
  },
  success: {
    backgroundColor: colors.successSurface,
    borderColor: colors.successEdge,
  },
  warning: {
    backgroundColor: colors.warningSurface,
    borderColor: colors.warningEdge,
  },
  danger: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerEdge,
  },
  info: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.infoEdge,
  },
})

const labelStyles = StyleSheet.create({
  default: {
    color: colors.textSecondary,
  },
  success: {
    color: colors.success,
  },
  warning: {
    color: colors.warning,
  },
  danger: {
    color: colors.error,
  },
  info: {
    color: colors.info,
  },
})
