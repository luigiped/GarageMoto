import { StyleSheet, Text, View } from 'react-native'
import { colors, designPreset, font, radius, spacing } from '../../theme'

export function MetricTile({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'accent' | 'info' | 'warning'
}) {
  return (
    <View style={[styles.tile, toneStyles[tone]]}>
      {designPreset === 'glass' ? <View pointerEvents="none" style={styles.glassEdge} /> : null}
      {designPreset === 'glass' ? <View pointerEvents="none" style={styles.glassInset} /> : null}
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: '47%',
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    shadowColor: designPreset === 'glass' ? colors.primary : '#000',
    shadowOpacity: designPreset === 'glass' ? 0.1 : 0,
    shadowRadius: designPreset === 'glass' ? 18 : 0,
    shadowOffset: { width: 0, height: 8 },
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  value: {
    color: colors.textPrimary,
    fontSize: font.xxxl,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  glassEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  glassInset: {
    position: 'absolute',
    inset: 1,
    borderRadius: radius.xl - 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
})

const toneStyles = StyleSheet.create({
  default: {
    backgroundColor: colors.surfaceDk,
    borderColor: colors.border,
  },
  accent: {
    backgroundColor: colors.surfaceDk,
    borderColor: colors.heroEdge,
  },
  info: {
    backgroundColor: colors.surfaceDk,
    borderColor: colors.infoEdge,
  },
  warning: {
    backgroundColor: colors.surfaceDk,
    borderColor: colors.warningEdge,
  },
})
