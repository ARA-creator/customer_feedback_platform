import { useEffect, useState } from 'react'
import { getPreferences } from '../services/notifications.api'

/** Cached notification prefs for realtime toasts and UI gating. */
export function useNotificationPrefs() {
  const [deliveryPrefs, setDeliveryPrefs] = useState({ realtime: true })
  const [loaded, setLoaded] = useState(false)

  const applyPrefs = (prefs) => {
    const p = prefs && typeof prefs === 'object' ? prefs : {}
    setDeliveryPrefs({
      ...p,
      // Default on unless the user explicitly saved false
      new_feedback: p.new_feedback !== false && (p.new_feedback === true || p.new_feedback === undefined),
      realtime: p.realtime !== false && (p.realtime === true || p.realtime === undefined),
    })
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const data = await getPreferences()
        if (!mounted) return
        applyPrefs(data?.prefs || {})
      } catch {
        if (mounted) applyPrefs({ realtime: true })
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

  const realtimeEnabled = Boolean(deliveryPrefs?.realtime)

  return { realtimeEnabled, deliveryPrefs, loaded }
}
