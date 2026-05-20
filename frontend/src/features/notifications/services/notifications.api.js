import { api, USE_DEV_API_PROXY, getBackendOrigin } from '../../../shared/lib/apiClient'

export async function getNotifications({ cursor, unreadOnly, limit } = {}) {
  const params = {}
  if (cursor) params.cursor = cursor
  if (unreadOnly) params.unread_only = true
  if (limit) params.limit = limit
  const res = await api.get('/notifications', { params })
  return res.data
}

export async function getUnreadCount() {
  const res = await api.get('/notifications/unread-count')
  return res.data
}

export function publishUnreadCount(unread) {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent('cfp-notifications-unread', { detail: { unread } }))
  } catch {
    // ignore
  }
}

export async function markRead({ ids, all } = {}) {
  const payload = {}
  if (all) payload.all = true
  if (Array.isArray(ids)) payload.ids = ids
  const res = await api.post('/notifications/mark-read', payload)
  if (Number.isFinite(Number(res?.data?.unread))) {
    publishUnreadCount(res.data.unread)
  }
  return res.data
}

export async function markUnread({ ids } = {}) {
  const payload = {}
  if (Array.isArray(ids)) payload.ids = ids
  const res = await api.post('/notifications/mark-unread', payload)
  if (Number.isFinite(Number(res?.data?.unread))) {
    publishUnreadCount(res.data.unread)
  }
  return res.data
}

export async function getPreferences() {
  const res = await api.get('/notifications/preferences')
  return res.data
}

export async function savePreferences(prefs) {
  const res = await api.post('/notifications/preferences', { prefs })
  return res.data
}

/**
 * Connect to the Notifications SSE stream.
 * Returns a cleanup function.
 */
export function connectNotificationsStream(onEvent) {
  const base = USE_DEV_API_PROXY ? '' : getBackendOrigin()
  const url = `${base}/api/notifications/stream`
  const es = new EventSource(url, { withCredentials: true })

  es.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data)
      onEvent?.(data)
    } catch {
      // ignore
    }
  }
  es.onerror = () => {
    // Browser will auto-retry. Keep silent to avoid console spam.
  }

  return () => {
    try {
      es.close()
    } catch {
      // ignore
    }
  }
}

