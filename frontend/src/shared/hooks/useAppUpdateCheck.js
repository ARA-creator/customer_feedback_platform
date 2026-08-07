import { useCallback, useEffect, useRef, useState } from 'react'

/** How often to check for a new production deploy (ms). */
const POLL_MS = 15_000

/** Brief pause so users see “Updating…” before the hard reload. */
const RELOAD_DELAY_MS = 1_200

function readLocalBuildId() {
  return String(import.meta.env.VITE_APP_BUILD_ID || '').trim()
}

/**
 * Detects a newer frontend deploy by comparing the baked-in build id with /version.json.
 * When a new version is live, reloads automatically (no manual Refresh needed).
 * Skips entirely in Vite dev (HMR already covers local edits).
 */
export function useAppUpdateCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const localIdRef = useRef(readLocalBuildId())
  const cancelledRef = useRef(false)
  const reloadingRef = useRef(false)

  const reload = useCallback(() => {
    if (reloadingRef.current) return
    reloadingRef.current = true
    window.location.reload()
  }, [])

  const check = useCallback(async () => {
    if (import.meta.env.DEV) return
    if (reloadingRef.current) return
    const localId = localIdRef.current
    if (!localId) return
    try {
      const res = await fetch(`/version.json?_=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return
      const data = await res.json()
      const remoteId = String(data?.version || data?.buildId || '').trim()
      if (!remoteId) return
      if (cancelledRef.current || remoteId === localId) return

      setUpdateAvailable(true)
      // Auto-apply the new deploy without waiting for a click.
      window.setTimeout(() => {
        if (!cancelledRef.current) reload()
      }, RELOAD_DELAY_MS)
    } catch {
      // Offline / transient — ignore.
    }
  }, [reload])

  useEffect(() => {
    cancelledRef.current = false
    if (import.meta.env.DEV) return undefined

    check()
    const intervalId = window.setInterval(check, POLL_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', check)

    return () => {
      cancelledRef.current = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', check)
    }
  }, [check])

  const dismiss = useCallback(() => {
    // Kept for API compatibility; auto-reload cannot be permanently dismissed.
    setUpdateAvailable(false)
  }, [])

  return { updateAvailable, reload, dismiss, check }
}
