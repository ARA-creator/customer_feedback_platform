import { useEffect, useRef } from 'react'

/** Sign out after this many milliseconds without keyboard or mouse activity. */
export const IDLE_LOGOUT_MS = 5 * 60 * 1000

export const IDLE_LOGOUT_FLAG_KEY = 'cfp_idle_logout'

/**
 * Only keyboard and pointer/mouse input count as activity.
 * (Not time-on-page, API polling, SSE, or programmatic scroll.)
 */
const ACTIVITY_EVENTS = [
  'keydown',
  'keyup',
  'mousedown',
  'mouseup',
  'click',
  'wheel',
  'touchstart',
  'pointerdown',
  'pointerup',
]

/** High-frequency pointer moves — throttled so movement keeps the session alive. */
const POINTER_MOVE_EVENTS = ['mousemove', 'pointermove']

const POINTER_MOVE_THROTTLE_MS = 2000

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
 * Signs out after `idleMs` with no keyboard or mouse/pointer activity in this tab.
 * Staying on the page with normal interaction does not trigger logout.
 */
export function useIdleLogout({ enabled = true, onIdle, idleMs = IDLE_LOGOUT_MS }) {
  const onIdleRef = useRef(onIdle)
  const logoutTimerRef = useRef(null)
  const lastActivityAtRef = useRef(Date.now())
  const lastPointerMoveAtRef = useRef(0)
  const pausedRef = useRef(false)

  useEffect(() => {
    onIdleRef.current = onIdle
  }, [onIdle])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined

    const clearLogoutTimer = () => {
      if (logoutTimerRef.current != null) {
        window.clearTimeout(logoutTimerRef.current)
        logoutTimerRef.current = null
      }
    }

    const msUntilIdleLimit = () => idleMs - (Date.now() - lastActivityAtRef.current)

    const fireIdleLogoutIfDue = () => {
      if (pausedRef.current) return
      if (msUntilIdleLimit() <= 0) {
        clearLogoutTimer()
        onIdleRef.current?.()
      }
    }

    /** Schedule logout for the remaining idle budget since the last real input event. */
    const scheduleIdleCheck = () => {
      clearLogoutTimer()
      if (pausedRef.current) return

      const remaining = msUntilIdleLimit()
      if (remaining <= 0) {
        fireIdleLogoutIfDue()
        return
      }

      logoutTimerRef.current = window.setTimeout(fireIdleLogoutIfDue, remaining)
    }

    const recordActivity = () => {
      lastActivityAtRef.current = Date.now()
      scheduleIdleCheck()
    }

    const onPointerMove = () => {
      const now = Date.now()
      if (now - lastPointerMoveAtRef.current < POINTER_MOVE_THROTTLE_MS) return
      lastPointerMoveAtRef.current = now
      recordActivity()
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        pausedRef.current = true
        clearLogoutTimer()
        return
      }
      pausedRef.current = false
      fireIdleLogoutIfDue()
      if (!logoutTimerRef.current) scheduleIdleCheck()
    }

    ACTIVITY_EVENTS.forEach((name) => {
      window.addEventListener(name, recordActivity, { passive: true, capture: true })
    })
    POINTER_MOVE_EVENTS.forEach((name) => {
      window.addEventListener(name, onPointerMove, { passive: true, capture: true })
    })
    document.addEventListener('visibilitychange', onVisibilityChange)

    lastActivityAtRef.current = Date.now()
    scheduleIdleCheck()

    return () => {
      ACTIVITY_EVENTS.forEach((name) => {
        window.removeEventListener(name, recordActivity, { capture: true })
      })
      POINTER_MOVE_EVENTS.forEach((name) => {
        window.removeEventListener(name, onPointerMove, { capture: true })
      })
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearLogoutTimer()
      pausedRef.current = false
    }
  }, [enabled, idleMs])
}
