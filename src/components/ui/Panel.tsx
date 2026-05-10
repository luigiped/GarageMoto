import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../../useTheme'

type Tone = 'default' | 'hero' | 'warning' | 'danger' | 'info'

export function Panel({
  title,
  subtitle,
  children,
  tone = 'default',
}: {
  title?: string
  subtitle?: string
  children?: ReactNode
  tone?: Tone
}) {
  const theme = useTheme()
  const styles = createStyles(theme)
  const panelTones = createPanelTones(theme)
  const titleTones = createTitleTones(theme)

  return (
    <View style={[styles.panel, panelTones[tone]]}>
      {theme.designPreset === 'glass' ? (
        <>
          <View pointerEvents="none" style={styles.glassShine} />
          <View pointerEvents="none" style={styles.glassRim} />
        </>
      ) : null}
      {title ? <Text style={[styles.title, titleTones[tone]]}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  )
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  const { colors, designPreset, font, radius, spacing } = theme

  return StyleSheet.create({
    panel: {
      borderRadius: radius.xl,
      padding: spacing.md,
      borderWidth: 1,
      marginBottom: spacing.md,
      overflow: 'hidden',
      shadowColor: designPreset === 'glass' ? colors.primary : '#000',
      shadowOpacity: designPreset === 'glass' ? 0.12 : 0,
      shadowRadius: designPreset === 'glass' ? 22 : 0,
      shadowOffset: { width: 0, height: 10 },
    },
    title: {
      fontSize: font.md,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: font.sm,
      lineHeight: 19,
      marginBottom: spacing.sm,
    },
    glassShine: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 44,
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    glassRim: {
      position: 'absolute',
      top: 1,
      right: 1,
      bottom: 1,
      left: 1,
      borderRadius: radius.xl - 1,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.05)',
    },
  })
}

function createPanelTones(theme: ReturnType<typeof useTheme>) {
  const { colors, designPreset } = theme

  return StyleSheet.create({
    default: {
      backgroundColor: designPreset === 'glass' ? colors.surfaceDk : colors.surfaceDk,
      borderColor: designPreset === 'glass' ? colors.borderStrong : colors.border,
    },
    hero: {
      backgroundColor: designPreset === 'glass' ? colors.surfaceDk : colors.heroSurface,
      borderColor: colors.heroEdge,
    },
    warning: {
      backgroundColor: designPreset === 'glass' ? colors.surfaceDk : colors.warningSurface,
      borderColor: colors.warningEdge,
    },
    danger: {
      backgroundColor: designPreset === 'glass' ? colors.surfaceDk : colors.dangerSurface,
      borderColor: colors.dangerEdge,
    },
    info: {
      backgroundColor: designPreset === 'glass' ? colors.surfaceDk : colors.infoSurface,
      borderColor: colors.infoEdge,
    },
  })
}

function createTitleTones(theme: ReturnType<typeof useTheme>) {
  const { colors } = theme

  return StyleSheet.create({
    default: {
      color: colors.textPrimary,
    },
    hero: {
      color: colors.accentSoft,
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
}
