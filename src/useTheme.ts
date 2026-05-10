import { getTheme } from './theme'
import { useThemeStore } from './store/themeStore'

export function useTheme() {
  const uiStyle = useThemeStore((state) => state.uiStyle)
  const colorTheme = useThemeStore((state) => state.colorTheme)
  const hydrated = useThemeStore((state) => state.hydrated)
  const theme = getTheme(colorTheme)

  return {
    designPreset: uiStyle,
    colorTheme,
    hydrated,
    colors: theme.colors,
    spacing: theme.spacing,
    radius: theme.radius,
    font: theme.font,
  }
}
