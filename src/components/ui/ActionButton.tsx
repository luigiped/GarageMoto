import type { ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTheme } from '../../useTheme'

type Variant = 'primary' | 'secondary' | 'warning' | 'danger'

export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  compact = false,
}: {
  label: string
  onPress: () => void
  variant?: Variant
  icon?: ReactNode
  disabled?: boolean
  loading?: boolean
  compact?: boolean
}) {
  const theme = useTheme()
  const styles = createStyles(theme)
  const buttonVariants = createButtonVariants(theme)
  const textVariants = createTextVariants(theme)
  const textColors = createTextColors(theme)

  return (
    <TouchableOpacity
      style={[
        styles.button,
        compact && styles.compact,
        buttonVariants[variant],
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={textColors[variant]} size="small" />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text style={[styles.label, textVariants[variant]]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  const { designPreset, font, radius, spacing } = theme

  return StyleSheet.create({
    button: {
      minHeight: 52,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
    },
    compact: {
      minHeight: 42,
      paddingVertical: 10,
      borderRadius: radius.md,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: {
      marginRight: spacing.sm,
    },
    label: {
      fontSize: font.base,
      fontWeight: '700',
      letterSpacing: designPreset === 'glass' ? 0.4 : 0,
    },
    disabled: {
      opacity: 0.55,
    },
  })
}

function createButtonVariants(theme: ReturnType<typeof useTheme>) {
  const { colors, designPreset } = theme

  return StyleSheet.create({
    primary: {
      backgroundColor: designPreset === 'glass' ? colors.primaryDk : colors.primary,
      borderColor: colors.primaryEdge,
    },
    secondary: {
      backgroundColor: colors.panelRaised,
      borderColor: colors.borderStrong,
    },
    warning: {
      backgroundColor: colors.warningSurface,
      borderColor: designPreset === 'glass' ? colors.borderStrong : colors.warningEdge,
    },
    danger: {
      backgroundColor: colors.dangerSurface,
      borderColor: designPreset === 'glass' ? colors.borderStrong : colors.dangerEdge,
    },
  })
}

function createTextVariants(theme: ReturnType<typeof useTheme>) {
  const { colors } = theme

  return StyleSheet.create({
    primary: {
      color: '#fff',
    },
    secondary: {
      color: colors.textPrimary,
    },
    warning: {
      color: colors.warning,
    },
    danger: {
      color: colors.error,
    },
  })
}

function createTextColors(theme: ReturnType<typeof useTheme>): Record<Variant, string> {
  const { colors } = theme
  return {
    primary: '#fff',
    secondary: colors.textPrimary,
    warning: colors.warning,
    danger: colors.error,
  }
}
