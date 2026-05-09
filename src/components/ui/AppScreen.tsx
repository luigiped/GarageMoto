import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { colors, designPreset, spacing } from '../../theme'

export function AppScreen({
  children,
  scroll = true,
  padded = true,
}: {
  children: ReactNode
  scroll?: boolean
  padded?: boolean
}) {
  if (!scroll) {
    return (
      <View style={styles.root}>
        <Aura />
        {designPreset === 'glass' ? <View pointerEvents="none" style={styles.gridVeil} /> : null}
        <View style={[styles.content, !padded && styles.unpadded]}>{children}</View>
      </View>
    )
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, !padded && styles.unpadded]}>
      <Aura />
      {designPreset === 'glass' ? <View pointerEvents="none" style={styles.gridVeil} /> : null}
      {children}
    </ScrollView>
  )
}

function Aura() {
  if (designPreset === 'glass') {
    return null
  }

  return (
    <>
      <View style={styles.auraPrimary} />
      <View style={styles.auraInfo} />
    </>
  )
}

const styles = StyleSheet.create({
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
    inset: 0,
    borderTopWidth: designPreset === 'glass' ? 0 : 1,
    borderColor: 'rgba(255,255,255,0.03)',
    backgroundColor: 'transparent',
  },
})
