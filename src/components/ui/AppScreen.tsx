import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useTheme } from '../../useTheme'

export function AppScreen({
  children,
  scroll = true,
  padded = true,
}: {
  children: ReactNode
  scroll?: boolean
  padded?: boolean
}) {
  const theme = useTheme()
  const styles = createStyles(theme)

  if (!scroll) {
    return (
      <View style={styles.root}>
        <Aura />
        {theme.designPreset === 'glass' ? <View pointerEvents="none" style={styles.gridVeil} /> : null}
        <View style={[styles.content, !padded && styles.unpadded]}>{children}</View>
      </View>
    )
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, !padded && styles.unpadded]}>
      <Aura />
      {theme.designPreset === 'glass' ? <View pointerEvents="none" style={styles.gridVeil} /> : null}
      {children}
    </ScrollView>
  )
}

function Aura() {
  const theme = useTheme()
  const styles = createStyles(theme)

  if (theme.designPreset === 'glass') {
    return null
  }

  return (
    <>
      <View style={styles.auraPrimary} />
      <View style={styles.auraInfo} />
    </>
  )
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  const { colors, designPreset, spacing } = theme

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bgDark,
    },
    content: {
      padding: spacing.md,
      paddingTop: 56,
      paddingBottom: spacing.xxl,
    },
    unpadded: {
      padding: 0,
    },
    auraPrimary: {
      position: 'absolute',
      top: designPreset === 'glass' ? -120 : -80,
      right: designPreset === 'glass' ? -70 : -40,
      width: designPreset === 'glass' ? 280 : 220,
      height: designPreset === 'glass' ? 280 : 220,
      borderRadius: 999,
      backgroundColor: colors.accentGlow,
    },
    auraInfo: {
      position: 'absolute',
      top: designPreset === 'glass' ? 220 : 180,
      left: designPreset === 'glass' ? -40 : -60,
      width: designPreset === 'glass' ? 220 : 160,
      height: designPreset === 'glass' ? 220 : 160,
      borderRadius: 999,
      backgroundColor: colors.infoGlow,
    },
    gridVeil: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderTopWidth: designPreset === 'glass' ? 0 : 1,
      borderColor: 'rgba(255,255,255,0.03)',
      backgroundColor: 'transparent',
    },
  })
}
