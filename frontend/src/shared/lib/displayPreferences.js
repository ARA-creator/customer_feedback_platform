const STORAGE_KEY = 'cfp_display_prefs'
const LEGACY_THEME_KEY = 'cfp_theme'

export const THEME_MODES = ['light', 'dark', 'system']
export const OVERVIEW_PERIOD_OPTIONS = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'last_week', label: 'Last week' },
  { id: 'month', label: 'This month' },
]

export const DISPLAY_PREFS_CHANGED = 'cfp-display-prefs-changed'

const DEFAULTS = {
  themeMode: 'light',
  reducedMotion: false,
  compactDensity: false,
  defaultOverviewPeriod: 'all',
}

function safeParse(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function migrateLegacyTheme() {
  try {
    const legacy = localStorage.getItem(LEGACY_THEME_KEY)
    if (legacy === 'dark' || legacy === 'light') {
      localStorage.removeItem(LEGACY_THEME_KEY)
      return legacy
    }
  } catch {
    // ignore
  }
  return null
}

export function loadDisplayPreferences() {
  const legacyTheme = migrateLegacyTheme()
  let stored = null
  try {
    stored = safeParse(localStorage.getItem(STORAGE_KEY))
  } catch {
    stored = null
  }

  const themeMode = THEME_MODES.includes(stored?.themeMode)
    ? stored.themeMode
    : legacyTheme || DEFAULTS.themeMode

  const defaultOverviewPeriod = OVERVIEW_PERIOD_OPTIONS.some((o) => o.id === stored?.defaultOverviewPeriod)
    ? stored.defaultOverviewPeriod
    : DEFAULTS.defaultOverviewPeriod

  return {
    themeMode,
    reducedMotion: Boolean(stored?.reducedMotion),
    compactDensity: Boolean(stored?.compactDensity),
    defaultOverviewPeriod,
  }
}

export function saveDisplayPreferences(partial) {
  const next = { ...loadDisplayPreferences(), ...partial }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore quota errors
  }
  applyDisplayPreferencesToDocument(next)
  try {
    window.dispatchEvent(new CustomEvent(DISPLAY_PREFS_CHANGED, { detail: next }))
  } catch {
    // ignore
  }
  return next
}

export function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Resolved appearance used for charts and the `dark` class on `<html>`. */
export function resolveTheme(themeMode) {
  if (themeMode === 'dark') return 'dark'
  if (themeMode === 'light') return 'light'
  return getSystemTheme()
}

export function applyDisplayPreferencesToDocument(prefs) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const resolved = resolveTheme(prefs.themeMode)
  root.classList.toggle('dark', resolved === 'dark')
  root.classList.toggle('cfp-compact', Boolean(prefs.compactDensity))
  root.classList.toggle('cfp-reduce-motion', Boolean(prefs.reducedMotion))
  try {
    localStorage.setItem(LEGACY_THEME_KEY, resolved)
  } catch {
    // keep legacy key in sync for any external scripts
  }
}

/** Call before React mounts to avoid theme flash. */
export function bootstrapDisplayPreferences() {
  applyDisplayPreferencesToDocument(loadDisplayPreferences())
}

export function getDefaultOverviewPeriod() {
  return loadDisplayPreferences().defaultOverviewPeriod
}
