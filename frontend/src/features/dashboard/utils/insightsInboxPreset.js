/** Map overview/insights time windows to inbox date_range values. */
export function timeWindowToInboxDateRange(timeWindow) {
  const tw = String(timeWindow || 'all').toLowerCase()
  if (tw === 'today' || tw === 'week') return '7d'
  if (tw === 'month') return '30d'
  if (tw === 'all') return 'all'
  return '30d'
}

/** Approximate day span for APIs that still take range_days (e.g. product-pulse-trend). */
export function timeWindowToRangeDays(timeWindow) {
  const tw = String(timeWindow || 'all').toLowerCase()
  if (tw === 'today') return 1
  if (tw === 'week') return 7
  if (tw === 'month') return 30
  if (tw === 'all') return 90
  return 30
}

export function buildThemePreset(themeKey, timeWindow, sentiment = 'all', status = 'all') {
  const tag = String(themeKey || '').trim()
  if (!tag) return null
  const preset = {
    insurance_tag: tag,
    date_range: timeWindowToInboxDateRange(timeWindow),
    sentiment: sentiment || 'all',
  }
  if (status === 'read' || status === 'replied') preset.list_tab = status
  return preset
}

export function buildSourcePreset(sourceKey, timeWindow, sentiment = 'all', status = 'all') {
  const src = String(sourceKey || '').trim().toLowerCase()
  if (!src) return null
  const preset = {
    source: src,
    date_range: timeWindowToInboxDateRange(timeWindow),
    sentiment: sentiment || 'all',
  }
  if (status === 'read' || status === 'replied') preset.list_tab = status
  return preset
}

export function buildCombinedPreset({ themeKey, sourceKey, timeWindow, sentiment = 'all', status = 'all' }) {
  const preset = {
    date_range: timeWindowToInboxDateRange(timeWindow),
    sentiment: sentiment || 'all',
  }
  const tag = String(themeKey || '').trim()
  const src = String(sourceKey || '').trim().toLowerCase()
  if (tag) preset.insurance_tag = tag
  if (src) preset.source = src
  if (status === 'read' || status === 'replied') preset.list_tab = status
  if (!tag && !src && status === 'all') return null
  if (!tag && !src && (status === 'read' || status === 'replied')) return preset
  if (!tag && !src) return null
  return preset
}

export function buildPeakPreset({ dow, hour, timeWindow }) {
  const preset = {}
  if (Number.isFinite(Number(dow))) preset.dow = Number(dow)
  if (Number.isFinite(Number(hour))) preset.hour = Number(hour)
  const rangeDays = timeWindowToRangeDays(timeWindow)
  if (Number.isFinite(rangeDays)) preset.range_days = rangeDays
  return preset
}

/** Peak presets use cfp_inbox_peak_preset; theme/source use cfp_inbox_anomaly_preset. */
export function inboxPresetStorageKey(preset) {
  const p = preset || {}
  const isPeak = Number.isFinite(Number(p.dow)) || Number.isFinite(Number(p.hour))
  return isPeak ? 'cfp_inbox_peak_preset' : 'cfp_inbox_anomaly_preset'
}


export function buildSentimentPreset(sentiment, timeWindow, status = 'all') {
  const preset = {
    date_range: timeWindowToInboxDateRange(timeWindow),
    sentiment: sentiment || 'all',
  }
  if (status === 'read' || status === 'replied') preset.list_tab = status
  return preset
}

export function buildFeedbackIdPreset(feedbackId) {
  const id = Number(feedbackId)
  if (!Number.isFinite(id) || id <= 0) return null
  return { open_feedback_id: id }
}

export function openFeedbackInInbox(feedbackId, onNavigateToInbox) {
  const id = Number(feedbackId)
  if (!Number.isFinite(id) || id <= 0) return
  try {
    sessionStorage.setItem('cfp_inbox_open_feedback_id', String(id))
  } catch {
    /* ignore */
  }
  onNavigateToInbox?.({ open_feedback_id: id })
}
