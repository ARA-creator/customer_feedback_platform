import { useEffect, useRef } from 'react'

/** Sign out after this many milliseconds without user activity. */
export const IDLE_LOGOUT_MS = 5 * 60 * 1000

export const IDLE_LOGOUT_FLAG_KEY = 'cfp_idle_logout'

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'wheel']

/** Throttle high-frequency events (e.g. scroll) when resetting the idle timer. */
const ACTIVITY_THROTTLE_MS = 1000

export function markIdleLogout() {
  try {
    sessionStorage.setItem(IDLE_LOGOUT_FLAG_KEY, '1')
  } catch {
    // ignore
  }
}

export function consumeIdleLogoutFlag() {
  try {
    if (sessionStorage.getItem(IDLE_LOGOUT_FLAG_KEY) !== '1') return false
    sessionStorage.removeItem(IDLE_LOGOUT_FLAG_KEY)
    return true
  } catch {
    return false
  }
}

/**
 * Calls `onIdle` after `idleMs` with no pointer/keyboard/scroll activity in this tab.
 */
export function useIdleLogout({ enabled = true, onIdle, idleMs = IDLE_LOGOUT_MS }) {
  const onIdleRef = useRef(onIdle)
  const timerRef = useRef(null)
  const lastActivityRef = useRef(0)

  useEffect(() => {
    onIdleRef.current = onIdle
  }, [onIdle])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined

    const clearTimer = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const schedule = () => {
      clearTimer()
      timerRef.current = window.setTimeout(() => {
        onIdleRef.current?.()
      }, idleMs)
    }

    const onActivity = () => {
      const now = Date.now()
      if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return
      lastActivityRef.current = now
      schedule()
    }

    ACTIVITY_EVENTS.forEach((name) => {
      window.addEventListener(name, onActivity, { passive: true, capture: true })
    })
    schedule()

    return () => {
      ACTIVITY_EVENTS.forEach((name) => {
        window.removeEventListener(name, onActivity, { capture: true })
      })
      clearTimer()
    }
  }, [enabled, idleMs])
}
