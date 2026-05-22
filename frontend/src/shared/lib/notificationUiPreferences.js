const STORAGE_KEY = 'cfp_notification_ui_prefs'

export const NOTIFICATION_UI_PREFS_CHANGED = 'cfp-notification-ui-prefs-changed'

const DEFAULTS = {
  quietHoursEnabled: false,
  quietStart: '22:00',
  quietEnd: '07:00',
}

function safeParse(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function parseMinutes(hhmm) {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

export function loadNotificationUiPrefs() {
  let stored = null
  try {
    stored = safeParse(localStorage.getItem(STORAGE_KEY))
  } catch {
    stored = null
  }
  return {
    quietHoursEnabled: Boolean(stored?.quietHoursEnabled),
    quietStart: typeof stored?.quietStart === 'string' ? stored.quietStart : DEFAULTS.quietStart,
    quietEnd: typeof stored?.quietEnd === 'string' ? stored.quietEnd : DEFAULTS.quietEnd,
  }
}

export function saveNotificationUiPrefs(partial) {
  const next = { ...loadNotificationUiPrefs(), ...partial }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(NOTIFICATION_UI_PREFS_CHANGED, { detail: next }))
  } catch {
    // ignore
  }
  return next
}

/** True when local quiet-hours window is active (supports overnight ranges). */
export function isQuietHoursActive(prefs = loadNotificationUiPrefs()) {
  if (!prefs?.quietHoursEnabled) return false
  const start = parseMinutes(prefs.quietStart)
  const end = parseMinutes(prefs.quietEnd)
  if (start == null || end == null) return false
  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  if (start === end) return true
  if (start < end) return cur >= start && cur < end
  return cur >= start || cur < end
}
