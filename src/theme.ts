import AsyncStorage from '@react-native-async-storage/async-storage'

// Design system GarageMoto.
//
// UX STYLE:
//   'glass' → layout mockup des2, hero fotografica, pannelli glassmorphism
//   'rally' → layout precedente piu solido/classico
//
// COLOR THEME:
//   'rally'    → arancione classico
//   'cobalt'   → blu notte
//   'rosso'    → rosso motorsport
//   'emerald'  → verde avventura
//   'titanium' → grigio acciaio
//   'violet'   → viola elettrico
//   'giallo'   → giallo racing

export type UiStyle = 'rally' | 'glass'
export type ColorTheme =
  | 'rally'
  | 'cobalt'
  | 'rosso'
  | 'emerald'
  | 'titanium'
  | 'violet'
  | 'giallo'

export const AVAILABLE_UI_STYLES: UiStyle[] = ['glass', 'rally']
export const AVAILABLE_COLOR_THEMES: ColorTheme[] = ['rally', 'cobalt', 'rosso', 'emerald', 'titanium', 'violet', 'giallo']

export const ACTIVE_UI_STYLE: UiStyle = 'glass'
export const ACTIVE_COLOR_THEME: ColorTheme = 'cobalt'
export const UI_STYLE_STORAGE_KEY = 'garagemoto.ui_style'
export const COLOR_THEME_STORAGE_KEY = 'garagemoto.color_theme'

type ThemeShape = {
  colors: {
    primary: string
    primaryDk: string
    primaryLt: string
    primaryEdge: string
    accentSoft: string
    accentGlow: string
    brandFantic: string        // Rosso brand Fantic — usare SOLO per il nome "Fantic"
    success: string
    successSurface: string
    successEdge: string
    warning: string
    warningSurface: string
    warningEdge: string
    error: string
    dangerSurface: string
    dangerEdge: string
    info: string
    infoSurface: string
    infoEdge: string
    infoGlow: string
    bgDark: string
    bgElevated: string
    surfaceDk: string
    panelRaised: string
    heroSurface: string
    heroEdge: string
    cardDk: string
    textPrimary: string
    textSecondary: string
    textMuted: string
    border: string
    borderStrong: string
  }
  spacing: {
    xs: number
    sm: number
    md: number
    lg: number
    xl: number
    xxl: number
  }
  radius: {
    sm: number
    md: number
    lg: number
    xl: number
    xxl: number
    full: number
  }
  font: {
    sm: number
    md: number
    base: number
    lg: number
    xl: number
    xxl: number
    display: number
    xxxl: number
  }
}

// ─── Valori condivisi tra tutti i preset ──────────────────────────────────────

const sharedSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

const sharedFont = {
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  display: 32,
  xxxl: 30,
}

// Semantica condivisa: success / warning / error uguali per tutti i preset,
// tranne 'giallo' che sposta warning su arancione per evitare conflitti col primary.
const sharedSemantic = {
  success: '#30D158',
  successSurface: 'rgba(48,209,88,0.12)',
  successEdge: 'rgba(48,209,88,0.28)',
  warning: '#FFD60A',
  warningSurface: 'rgba(255,214,10,0.12)',
  warningEdge: 'rgba(255,214,10,0.30)',
  error: '#FF453A',
  dangerSurface: 'rgba(255,69,58,0.12)',
  dangerEdge: 'rgba(255,69,58,0.30)',
}

function glassSurfaces(surface: string, raised: string, card: string) {
  return {
    surfaceDk: surface,
    panelRaised: raised,
    cardDk: card,
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.72)',
    textMuted: 'rgba(255,255,255,0.44)',
    border: 'rgba(255,255,255,0.12)',
    borderStrong: 'rgba(255,255,255,0.22)',
  }
}

const sharedGlassRadius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  xxl: 28,
  full: 999,
}

const sharedGlassFont = { ...sharedFont, display: 34 }

// ─── PRESET ───────────────────────────────────────────────────────────────────

const THEMES: Record<ColorTheme, ThemeShape> = {

  // ── 1. RALLY — Arancione classico ───────────────────────────────────────────
  // Stile solido (no rgba), preset originale mantenuto invariato.
  rally: {
    colors: {
      primary: '#F26A21',
      primaryDk: '#C64B0B',
      primaryLt: '#FFB37C',
      primaryEdge: 'rgba(242,106,33,0.45)',
      accentSoft: '#FFB37C',
      accentGlow: 'rgba(242,106,33,0.10)',
      brandFantic: '#e4052c',
      ...sharedSemantic,
      info: '#5BC0EB',
      infoSurface: 'rgba(91,192,235,0.10)',
      infoEdge: 'rgba(91,192,235,0.28)',
      infoGlow: 'rgba(91,192,235,0.08)',
      bgDark: '#0B0D12',
      bgElevated: '#10141D',
      surfaceDk: '#131722',
      panelRaised: '#1A2030',
      heroSurface: 'rgba(242,106,33,0.12)',
      heroEdge: 'rgba(242,106,33,0.28)',
      cardDk: '#151B27',
      textPrimary: '#F4F7FB',
      textSecondary: '#B2BED2',
      textMuted: '#7F8CA4',
      border: '#283044',
      borderStrong: '#364158',
    },
    spacing: sharedSpacing,
    radius: {
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      xxl: 28,
      full: 999,
    },
    font: sharedFont,
  },

  // ── 2. COBALT SPEED — Blu notte ─────────────────────────────────────────────
  // Info spostato su cyan (#06B6D4) per non confondersi col primary blu.
  cobalt: {
    colors: {
      primary: '#1971C2',
      primaryDk: '#0D4A8C',
      primaryLt: '#74B0FF',
      primaryEdge: 'rgba(25,113,194,0.40)',
      accentSoft: '#A5C8FF',
      accentGlow: 'rgba(25,113,194,0.22)',
      brandFantic: '#e4052c',
      ...sharedSemantic,
      info: '#06B6D4',
      infoSurface: 'rgba(6,182,212,0.12)',
      infoEdge: 'rgba(6,182,212,0.28)',
      infoGlow: 'rgba(6,182,212,0.10)',
      bgDark: '#06080F',
      bgElevated: 'rgba(8,14,28,0.92)',
      heroSurface: 'rgba(25,113,194,0.14)',
      heroEdge: 'rgba(25,113,194,0.30)',
      ...glassSurfaces(
        'rgba(14,24,42,0.54)',
        'rgba(16,31,58,0.62)',
        'rgba(18,38,70,0.42)',
      ),
    },
    spacing: sharedSpacing,
    radius: sharedGlassRadius,
    font: sharedGlassFont,
  },

  // ── 3. ROSSO CORSA — Rosso motorsport ───────────────────────────────────────
  // Error usa un rosso più saturo/luminoso (#FF2D20) per distinguersi dal primary scuro.
  rosso: {
    colors: {
      primary: '#C1121F',
      primaryDk: '#800E14',
      primaryLt: '#FF6B6B',
      primaryEdge: 'rgba(193,18,31,0.40)',
      accentSoft: '#FFAAAA',
      accentGlow: 'rgba(193,18,31,0.20)',
      brandFantic: '#e4052c',
      ...sharedSemantic,
      error: '#FF2D20',
      dangerSurface: 'rgba(255,45,32,0.12)',
      dangerEdge: 'rgba(255,45,32,0.30)',
      info: '#0A84FF',
      infoSurface: 'rgba(10,132,255,0.12)',
      infoEdge: 'rgba(10,132,255,0.28)',
      infoGlow: 'rgba(10,132,255,0.10)',
      bgDark: '#0A0606',
      bgElevated: 'rgba(20,8,8,0.92)',
      heroSurface: 'rgba(193,18,31,0.14)',
      heroEdge: 'rgba(193,18,31,0.32)',
      ...glassSurfaces(
        'rgba(42,14,18,0.54)',
        'rgba(56,16,22,0.62)',
        'rgba(70,20,28,0.42)',
      ),
    },
    spacing: sharedSpacing,
    radius: sharedGlassRadius,
    font: sharedGlassFont,
  },

  // ── 4. EMERALD TRAIL — Verde avventura ──────────────────────────────────────
  emerald: {
    colors: {
      primary: '#059669',
      primaryDk: '#03543F',
      primaryLt: '#6EE7B7',
      primaryEdge: 'rgba(5,150,105,0.38)',
      accentSoft: '#A7F3D0',
      accentGlow: 'rgba(5,150,105,0.20)',
      brandFantic: '#e4052c',
      ...sharedSemantic,
      info: '#0A84FF',
      infoSurface: 'rgba(10,132,255,0.12)',
      infoEdge: 'rgba(10,132,255,0.28)',
      infoGlow: 'rgba(10,132,255,0.10)',
      bgDark: '#050C08',
      bgElevated: 'rgba(6,14,10,0.92)',
      heroSurface: 'rgba(5,150,105,0.14)',
      heroEdge: 'rgba(5,150,105,0.30)',
      ...glassSurfaces(
        'rgba(10,32,24,0.54)',
        'rgba(12,44,32,0.62)',
        'rgba(14,56,40,0.42)',
      ),
    },
    spacing: sharedSpacing,
    radius: sharedGlassRadius,
    font: sharedGlassFont,
  },

  // ── 5. TITANIUM — Grigio acciaio ────────────────────────────────────────────
  // Primary su blu-grigio (#6B8BA4): leggibile con testo bianco, percepito "silver/steel".
  titanium: {
    colors: {
      primary: '#6B8BA4',
      primaryDk: '#3D5A72',
      primaryLt: '#B0C8DC',
      primaryEdge: 'rgba(107,139,164,0.38)',
      accentSoft: '#D0E0EC',
      accentGlow: 'rgba(107,139,164,0.18)',
      brandFantic: '#e4052c',
      ...sharedSemantic,
      info: '#0A84FF',
      infoSurface: 'rgba(10,132,255,0.12)',
      infoEdge: 'rgba(10,132,255,0.28)',
      infoGlow: 'rgba(10,132,255,0.10)',
      bgDark: '#06070A',
      bgElevated: 'rgba(10,12,16,0.92)',
      heroSurface: 'rgba(107,139,164,0.14)',
      heroEdge: 'rgba(107,139,164,0.28)',
      ...glassSurfaces(
        'rgba(24,30,38,0.56)',
        'rgba(30,38,48,0.64)',
        'rgba(40,50,62,0.44)',
      ),
    },
    spacing: sharedSpacing,
    radius: sharedGlassRadius,
    font: sharedGlassFont,
  },

  // ── 6. DARK VIOLET — Viola elettrico ────────────────────────────────────────
  // Info su cyan per non confondersi col primary viola.
  violet: {
    colors: {
      primary: '#7C3AED',
      primaryDk: '#4C1D95',
      primaryLt: '#C4B5FD',
      primaryEdge: 'rgba(124,58,237,0.40)',
      accentSoft: '#DDD6FE',
      accentGlow: 'rgba(124,58,237,0.22)',
      brandFantic: '#e4052c',
      ...sharedSemantic,
      info: '#06B6D4',
      infoSurface: 'rgba(6,182,212,0.12)',
      infoEdge: 'rgba(6,182,212,0.28)',
      infoGlow: 'rgba(6,182,212,0.10)',
      bgDark: '#07060F',
      bgElevated: 'rgba(10,6,20,0.92)',
      heroSurface: 'rgba(124,58,237,0.14)',
      heroEdge: 'rgba(124,58,237,0.30)',
      ...glassSurfaces(
        'rgba(22,16,42,0.54)',
        'rgba(30,20,58,0.62)',
        'rgba(40,28,74,0.42)',
      ),
    },
    spacing: sharedSpacing,
    radius: sharedGlassRadius,
    font: sharedGlassFont,
  },

  // ── 7. GIALLO CORSA — Giallo racing ─────────────────────────────────────────
  // Warning spostato su arancione (#FF9500) — il primary è già giallo.
  // Info su blu per il massimo contrasto cromatico col giallo.
  giallo: {
    colors: {
      primary: '#F5C200',
      primaryDk: '#C49800',
      primaryLt: '#FFE566',
      primaryEdge: 'rgba(245,194,0,0.40)',
      accentSoft: '#FFF0A0',
      accentGlow: 'rgba(245,194,0,0.20)',
      brandFantic: '#e4052c',
      success: '#30D158',
      successSurface: 'rgba(48,209,88,0.12)',
      successEdge: 'rgba(48,209,88,0.28)',
      warning: '#FF9500',                         // arancione — primary è giallo
      warningSurface: 'rgba(255,149,0,0.12)',
      warningEdge: 'rgba(255,149,0,0.30)',
      error: '#FF453A',
      dangerSurface: 'rgba(255,69,58,0.12)',
      dangerEdge: 'rgba(255,69,58,0.30)',
      info: '#0A84FF',
      infoSurface: 'rgba(10,132,255,0.12)',
      infoEdge: 'rgba(10,132,255,0.28)',
      infoGlow: 'rgba(10,132,255,0.10)',
      bgDark: '#090800',
      bgElevated: 'rgba(18,16,6,0.92)',
      heroSurface: 'rgba(245,194,0,0.12)',
      heroEdge: 'rgba(245,194,0,0.28)',
      ...glassSurfaces(
        'rgba(40,32,10,0.54)',
        'rgba(54,42,12,0.62)',
        'rgba(70,54,16,0.42)',
      ),
    },
    spacing: sharedSpacing,
    radius: sharedGlassRadius,
    font: sharedGlassFont,
  },
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function getTheme(colorTheme: ColorTheme): ThemeShape {
  return THEMES[colorTheme]
}

let activeUiStyle: UiStyle = ACTIVE_UI_STYLE
let activeColorTheme: ColorTheme = ACTIVE_COLOR_THEME
let activeTheme = getTheme(ACTIVE_COLOR_THEME)

export let designPreset: UiStyle = activeUiStyle
export let colorTheme: ColorTheme = activeColorTheme
export let colors: ThemeShape['colors'] = activeTheme.colors
export let spacing: ThemeShape['spacing'] = activeTheme.spacing
export let radius: ThemeShape['radius'] = activeTheme.radius
export let font: ThemeShape['font'] = activeTheme.font

export function applyThemeSelection(uiStyle: UiStyle, nextColorTheme: ColorTheme) {
  activeUiStyle = uiStyle
  activeColorTheme = nextColorTheme
  activeTheme = getTheme(nextColorTheme)
  designPreset = activeUiStyle
  colorTheme = activeColorTheme
  colors = activeTheme.colors
  spacing = activeTheme.spacing
  radius = activeTheme.radius
  font = activeTheme.font
}

export async function persistThemeSelection(uiStyle: UiStyle, nextColorTheme: ColorTheme) {
  await AsyncStorage.multiSet([
    [UI_STYLE_STORAGE_KEY, uiStyle],
    [COLOR_THEME_STORAGE_KEY, nextColorTheme],
  ])
}

export async function hydrateThemeSelection() {
  try {
    const entries = await AsyncStorage.multiGet([UI_STYLE_STORAGE_KEY, COLOR_THEME_STORAGE_KEY])
    const storedUiStyle = entries[0]?.[1]
    const storedColorTheme = entries[1]?.[1]
    const nextUiStyle = AVAILABLE_UI_STYLES.includes(storedUiStyle as UiStyle)
      ? storedUiStyle as UiStyle
      : ACTIVE_UI_STYLE
    const nextColorTheme = AVAILABLE_COLOR_THEMES.includes(storedColorTheme as ColorTheme)
      ? storedColorTheme as ColorTheme
      : ACTIVE_COLOR_THEME
    applyThemeSelection(nextUiStyle, nextColorTheme)
  } catch (error) {
    console.error('[theme] hydrate selection:', error)
    applyThemeSelection(ACTIVE_UI_STYLE, ACTIVE_COLOR_THEME)
  }
}
