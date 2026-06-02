/** Cross-tab sync via localStorage `storage` events (separate tabs/windows). */

export const NOTIFICATIONS_UNREAD_KEY = 'cfp_notifications_unread_v1'

export function publishNotificationsUnread(unread) {
  if (typeof window === 'undefined') return
  const n = Number(unread)
  const safe = Number.isFinite(n) && n >= 0 ? n : 0
  try {
    localStorage.setItem(NOTIFICATIONS_UNREAD_KEY, String(safe))
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent('cfp-notifications-unread', { detail: { unread: safe } }))
  } catch {
    // ignore
  }
}

export function readNotificationsUnreadFromStorage() {
  try {
    const n = Number(localStorage.getItem(NOTIFICATIONS_UNREAD_KEY))
    return Number.isFinite(n) && n >= 0 ? n : null
  } catch {
    return null
  }
}
