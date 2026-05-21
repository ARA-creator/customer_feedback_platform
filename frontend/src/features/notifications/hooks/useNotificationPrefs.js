import { useEffect, useState } from 'react'
import { getPreferences } from '../services/notifications.api'

/** Cached notification prefs for realtime toasts and UI gating. */
export function useNotificationPrefs() {
  const [realtimeEnabled, setRealtimeEnabled] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const applyPrefs = (prefs) => {
    setRealtimeEnabled(Boolean(prefs?.realtime))
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const data = await getPreferences()
        if (!mounted) return
        applyPrefs(data?.prefs || {})
      } catch {
        if (mounted) applyPrefs({})
      } finally {
        if (mounted) setLoaded(true)
      }
    })()
    const onPrefsChanged = (e) => {
      applyPrefs(e?.detail?.prefs || {})
    }
    window.addEventListener('cfp-notification-prefs-changed', onPrefsChanged)
    return () => {
      mounted = false
      window.removeEventListener('cfp-notification-prefs-changed', onPrefsChanged)
    }
  }, [])

  return { realtimeEnabled, loaded }
}
