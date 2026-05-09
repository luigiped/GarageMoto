import { StyleSheet, Text, View } from 'react-native'
import { colors, designPreset, font, spacing } from '../../theme'

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
}) {
  return (
    <View style={styles.wrap}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {designPreset === 'glass' ? <View style={styles.rule} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  eyebrow: {
    color: colors.accentSoft,
    fontSize: 11,
    letterSpacing: designPreset === 'glass' ? 2.4 : 1.8,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontWeight: '600',
  },
  title: {
    color: colors.textPrimary,
    fontSize: font.display,
    fontWeight: '800',
    letterSpacing: designPreset === 'glass' ? -0.2 : -0.8,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: font.base,
    lineHeight: 22,
    marginTop: 6,
  },
  rule: {
    width: 76,
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.primary,
    marginTop: spacing.md,
    opacity: 0.9,
  },
})
