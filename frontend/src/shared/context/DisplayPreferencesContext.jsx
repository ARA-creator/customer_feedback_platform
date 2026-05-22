import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  applyDisplayPreferencesToDocument,
  loadDisplayPreferences,
  resolveTheme,
  saveDisplayPreferences,
} from '../lib/displayPreferences'

const DisplayPreferencesContext = createContext(null)

export function DisplayPreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(() => loadDisplayPreferences())
  const [systemTheme, setSystemTheme] = useState(() => resolveTheme('system'))

  const resolvedTheme = useMemo(
    () => (prefs.themeMode === 'system' ? systemTheme : resolveTheme(prefs.themeMode)),
    [prefs.themeMode, systemTheme],
  )

  useEffect(() => {
    applyDisplayPreferencesToDocument(prefs)
  }, [prefs])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemTheme(mq.matches ? 'dark' : 'light')
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const updatePreferences = useCallback((partial) => {
    setPrefs((prev) => {
      const next = saveDisplayPreferences({ ...prev, ...partial })
      return next
    })
  }, [])

  const setThemeMode = useCallback(
    (themeMode) => {
      updatePreferences({ themeMode })
    },
    [updatePreferences],
  )

  const toggleTheme = useCallback(() => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark'
    setThemeMode(next)
  }, [resolvedTheme, setThemeMode])

  const value = useMemo(
    () => ({
      prefs,
      resolvedTheme,
      updatePreferences,
      setThemeMode,
      toggleTheme,
    }),
    [prefs, resolvedTheme, updatePreferences, setThemeMode, toggleTheme],
  )

  return (
    <DisplayPreferencesContext.Provider value={value}>{children}</DisplayPreferencesContext.Provider>
  )
}

export function useDisplayPreferences() {
  const ctx = useContext(DisplayPreferencesContext)
  if (!ctx) {
    throw new Error('useDisplayPreferences must be used within DisplayPreferencesProvider')
  }
  return ctx
}
