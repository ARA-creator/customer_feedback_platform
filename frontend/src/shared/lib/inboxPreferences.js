const STORAGE_KEY = 'cfp_inbox_prefs'
const ARCHIVE_KEY = 'cfp_archived_feedback_ids'

export const INBOX_PREFS_CHANGED = 'cfp-inbox-prefs-changed'

export const INBOX_SENTIMENT_OPTIONS = [
  { id: 'all', label: 'All sentiments' },
  { id: 'positive', label: 'Positive' },
  { id: 'negative', label: 'Negative' },
  { id: 'neutral', label: 'Neutral' },
]

export const INBOX_PRIORITY_OPTIONS = [
  { id: 'all', label: 'All priorities' },
  { id: 'high', label: 'High priority' },
  { id: 'normal', label: 'Normal' },
]

const DEFAULTS = {
  defaultSentiment: 'all',
  defaultPriority: 'all',
}

function safeParse(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function loadInboxPreferences() {
  let stored = null
  try {
    stored = safeParse(localStorage.getItem(STORAGE_KEY))
  } catch {
    stored = null
  }
  const defaultSentiment = INBOX_SENTIMENT_OPTIONS.some((o) => o.id === stored?.defaultSentiment)
    ? stored.defaultSentiment
    : DEFAULTS.defaultSentiment
  const defaultPriority = INBOX_PRIORITY_OPTIONS.some((o) => o.id === stored?.defaultPriority)
    ? stored.defaultPriority
    : DEFAULTS.defaultPriority
  return { defaultSentiment, defaultPriority }
}

export function saveInboxPreferences(partial) {
  const next = { ...loadInboxPreferences(), ...partial }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(INBOX_PREFS_CHANGED, { detail: next }))
  } catch {
    // ignore
  }
  return next
}

export function getDefaultInboxPreset() {
  const { defaultSentiment, defaultPriority } = loadInboxPreferences()
  return { sentiment: defaultSentiment, priority: defaultPriority }
}

export function clearArchivedFeedbackIds() {
  try {
    localStorage.removeItem(ARCHIVE_KEY)
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent('cfp-archived-feedback-cleared'))
  } catch {
    // ignore
  }
}

export function getArchivedFeedbackCount() {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.length : 0
  } catch {
    return 0
  }
}
