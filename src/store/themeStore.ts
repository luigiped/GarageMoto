import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import {
  ACTIVE_COLOR_THEME,
  ACTIVE_UI_STYLE,
  AVAILABLE_COLOR_THEMES,
  AVAILABLE_UI_STYLES,
  COLOR_THEME_STORAGE_KEY,
  UI_STYLE_STORAGE_KEY,
  type ColorTheme,
  type UiStyle,
} from '../theme'

interface ThemeStore {
  uiStyle: UiStyle
  colorTheme: ColorTheme
  hydrated: boolean
  hydrateTheme: () => Promise<void>
  setColorTheme: (colorTheme: ColorTheme) => Promise<void>
  setUiStyle: (uiStyle: UiStyle) => Promise<void>
}

function isValidUiStyle(value: string | null): value is UiStyle {
  return AVAILABLE_UI_STYLES.includes(value as UiStyle)
}

function isValidColorTheme(value: string | null): value is ColorTheme {
  return AVAILABLE_COLOR_THEMES.includes(value as ColorTheme)
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  uiStyle: ACTIVE_UI_STYLE,
  colorTheme: ACTIVE_COLOR_THEME,
  hydrated: false,

  hydrateTheme: async () => {
    if (get().hydrated) {
      return
    }

    try {
      const entries = await AsyncStorage.multiGet([UI_STYLE_STORAGE_KEY, COLOR_THEME_STORAGE_KEY])
      const storedUiStyle = entries[0]?.[1] ?? null
      const storedColorTheme = entries[1]?.[1] ?? null

      set({
        uiStyle: isValidUiStyle(storedUiStyle) ? storedUiStyle : ACTIVE_UI_STYLE,
        colorTheme: isValidColorTheme(storedColorTheme) ? storedColorTheme : ACTIVE_COLOR_THEME,
        hydrated: true,
      })
    } catch (error) {
      console.error('[themeStore] hydrateTheme:', error)
      set({
        uiStyle: ACTIVE_UI_STYLE,
        colorTheme: ACTIVE_COLOR_THEME,
        hydrated: true,
      })
    }
  },

  setColorTheme: async (nextColorTheme) => {
    set({ colorTheme: nextColorTheme })
    try {
      await AsyncStorage.setItem(COLOR_THEME_STORAGE_KEY, nextColorTheme)
    } catch (error) {
      console.error('[themeStore] setColorTheme:', error)
    }
  },

  setUiStyle: async (nextUiStyle) => {
    set({ uiStyle: nextUiStyle })
    try {
      await AsyncStorage.setItem(UI_STYLE_STORAGE_KEY, nextUiStyle)
    } catch (error) {
      console.error('[themeStore] setUiStyle:', error)
    }
  },
}))
