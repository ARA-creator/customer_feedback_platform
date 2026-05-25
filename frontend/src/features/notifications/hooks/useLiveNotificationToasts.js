import { useCallback, useEffect, useRef } from 'react'
import { getNotifications, getUnreadCount } from '../services/notifications.api'
import { shouldShowLiveToast } from '../utils/toastPolicy'
import { isQuietHoursActive, loadNotificationUiPrefs } from '../../../shared/lib/notificationUiPreferences'

const POLL_MS = 15_000

/**
 * Live toast delivery via SSE plus unread polling (covers multi-process deploys and missed SSE).
 */
export function useLiveNotificationToasts({
  enabled,
  deliveryPrefs,
  onToast,
}) {
  const lastUnreadRef = useRef(null)
  const toastedIdsRef = useRef(new Set())
  const prefsRef = useRef(deliveryPrefs)
  prefsRef.current = deliveryPrefs

  const maybeToast = useCallback(
    (notification, unread) => {
      if (!notification?.id) return
      if (toastedIdsRef.current.has(notification.id)) return
      if (isQuietHoursActive(loadNotificationUiPrefs())) return
      if (!shouldShowLiveToast(notification, prefsRef.current)) return
      toastedIdsRef.current.add(notification.id)
      onToast?.(notification, unread)
    },
    [onToast],
  )

  const pollUnread = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    try {
      const res = await getUnreadCount()
      const unread = Number(res?.unread)
      if (!Number.isFinite(unread)) return
      const prev = lastUnreadRef.current
      lastUnreadRef.current = unread
      if (prev === null || unread <= prev) return
      const list = await getNotifications({ limit: 1, unreadOnly: true })
      const latest = Array.isArray(list?.items) ? list.items[0] : null
      maybeToast(latest, unread)
    } catch {
      // ignore poll errors
    }
  }, [maybeToast])

  useEffect(() => {
    if (!enabled) return undefined
    lastUnreadRef.current = null
    const bootstrap = async () => {
      try {
        const res = await getUnreadCount()
        const unread = Number(res?.unread)
        if (Number.isFinite(unread)) lastUnreadRef.current = unread
      } catch {
        lastUnreadRef.current = 0
      }
    }
    bootstrap()
    const id = window.setInterval(pollUnread, POLL_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') pollUnread()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [enabled, pollUnread])

  const handleStreamEvent = useCallback(
    (evt) => {
      if (evt?.type !== 'notification.created' || !evt?.notification) return
      if (Number.isFinite(Number(evt.unread))) {
        lastUnreadRef.current = Number(evt.unread)
      }
      maybeToast(evt.notification, evt.unread)
    },
    [maybeToast],
  )

  return { handleStreamEvent }
}
