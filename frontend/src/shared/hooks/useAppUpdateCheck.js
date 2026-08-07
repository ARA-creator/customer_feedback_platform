import { useCallback, useEffect, useRef, useState } from 'react'

/** Poll interval for production deploy detection (ms). */
const POLL_MS = 60_000

function readLocalBuildId() {
  return String(import.meta.env.VITE_APP_BUILD_ID || '').trim()
}

/**
 * Detects a newer frontend deploy by comparing the baked-in build id with /version.json.
 * Skips entirely in Vite dev (HMR already covers local edits).
 */
export function useAppUpdateCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const localIdRef = useRef(readLocalBuildId())
  const cancelledRef = useRef(false)

  const check = useCallback(async () => {
    if (import.meta.env.DEV) return
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
      if (!cancelledRef.current && remoteId !== localId) {
        setUpdateAvailable(true)
      }
    } catch {
      // Offline / transient — ignore.
    }
  }, [])

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

  const reload = useCallback(() => {
    window.location.reload()
  }, [])

  const dismiss = useCallback(() => {
    setUpdateAvailable(false)
  }, [])

  return { updateAvailable, reload, dismiss, check }
}
