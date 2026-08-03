import { channelMessageTitle } from './channelMessagePresentation'

/** Client-side inbox analytics derived from the loaded feed. */

const THEME_DISPLAY_LABELS = {
  speed_delays: 'Delivery delays',
}

function formatThemeLabel(key) {
  const k = String(key || '').trim().toLowerCase()
  if (THEME_DISPLAY_LABELS[k]) return THEME_DISPLAY_LABELS[k]
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatHourLabel(hour) {
  const h = ((Number(hour) % 24) + 24) % 24
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12} ${period}`
}

function safeTags(item) {
  const raw = item?.insurance_tags || item?.channel_metadata?.insurance_tags
  return Array.isArray(raw) ? raw : []
}

function localDayKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** True when feedback arrived on the user's local calendar day. */
export function isCreatedToday(item, now = new Date()) {
  const raw = item?.created_at
  if (!raw) return false
  const t = new Date(raw)
  if (!Number.isFinite(t.getTime())) return false
  return localDayKey(t) === localDayKey(now)
}

function isUnreadId(readIds, id) {
  const n = Number(id)
  if (!Number.isFinite(n)) return true
  return !readIds?.has?.(n)
}

export function extractFeedbackTitle(item) {
  return channelMessageTitle(item)
}

export function getPriorityBadge(item) {
  const score = Number(item?.priority ?? item?.impact_score ?? 0)
  if (score >= 80) return { label: 'High', tone: 'high' }
  if (score >= 50) return { label: 'Medium', tone: 'medium' }
  return { label: 'Low', tone: 'low' }
}

export function isHighPriority(item) {
  const score = Number(item?.priority ?? item?.impact_score ?? 0)
  return score >= 80
}

export function needsResponse(item) {
  if (item?.replied_at) return false
  const s = String(item?.sentiment_label || '').toLowerCase()
  return s === 'negative' || isHighPriority(item)
}

/**
 * "New feedback" = arrived on the user's local calendar day only.
 * Resets each day (yesterday's items are no longer "new").
 */
export function isNewFeedback(item, _readIds, now = new Date()) {
  return isCreatedToday(item, now)
}

/**
 * Stable unread count for the current inbox filter.
 * Uses server total when available; unloaded rows count as unread until marked read.
 */
export function computeStableUnreadCount({ total, scopedIds, readIds, loadedItems }) {
  const totalN = Number(total)
  const scoped = scopedIds?.size ? scopedIds : null
  if (Number.isFinite(totalN) && totalN >= 0 && scoped) {
    if (scoped.size >= totalN) {
      let unread = 0
      for (const id of scoped) {
        if (isUnreadId(readIds, id)) unread += 1
      }
      return unread
    }
    if (totalN > 0) {
      let readKnown = 0
      for (const id of scoped) {
        if (!isUnreadId(readIds, id)) readKnown += 1
      }
      const known = scoped.size
      const unreadKnown = known - readKnown
      const unreadUnknown = Math.max(0, totalN - known)
      return unreadUnknown + unreadKnown
    }
  }
  const arr = Array.isArray(loadedItems) ? loadedItems : []
  return arr.filter((it) => isUnreadId(readIds, it?.id)).length
}

/**
 * Count of feedback received today (local calendar day).
 */
export function computeNewFeedbackCount({ loadedItems, now = new Date() } = {}) {
  const arr = Array.isArray(loadedItems) ? loadedItems : []
  let n = 0
  for (const it of arr) {
    if (isCreatedToday(it, now)) n += 1
  }
  return n
}

export function computeInboxStats(items, { readIds, folder } = {}) {
  const arr = Array.isArray(items) ? items : []
  const inboxItems = folder === 'archive' ? arr : arr
  let high = 0
  let negative = 0
  for (const it of inboxItems) {
    if (isHighPriority(it)) high += 1
    if (String(it?.sentiment_label || '').toLowerCase() === 'negative') negative += 1
  }
  const total = inboxItems.length
  const negativePct = total > 0 ? Math.round((negative / total) * 100) : 0
  const newCount = computeNewFeedbackCount({ loadedItems: inboxItems })

  return {
    newCount,
    highPriorityCount: high,
    negativePct,
    avgResponseLabel: '—',
    trendingTopicLabel: computeTrendingTopicLabel(inboxItems),
    avgPeakHoursLabel: computeAvgPeakHourLabel(inboxItems),
    total,
  }
}

export function computeTrendingTopicLabel(items) {
  const themes = computeTopThemes(items, 1)
  if (themes.length === 0) return '—'
  return themes[0].label
}

export function computeAvgPeakHourLabel(items) {
  const arr = Array.isArray(items) ? items : []
  const counts = new Array(24).fill(0)
  for (const it of arr) {
    if (!it?.created_at) continue
    const h = new Date(it.created_at).getHours()
    if (Number.isFinite(h) && h >= 0 && h <= 23) counts[h] += 1
  }
  const total = counts.reduce((a, b) => a + b, 0)
  if (total === 0) return '—'

  let sum = 0
  for (let h = 0; h < 24; h += 1) sum += h * counts[h]
  const avgHour = Math.round(sum / total)

  let peakHour = 0
  let peak = 0
  for (let h = 0; h < 24; h += 1) {
    if (counts[h] > peak) {
      peak = counts[h]
      peakHour = h
    }
  }

  if (peakHour === avgHour) return formatHourLabel(avgHour)
  const lo = Math.min(avgHour, peakHour)
  const hi = Math.max(avgHour, peakHour)
  return `${formatHourLabel(lo)}–${formatHourLabel(hi)}`
}

export function computeTopThemes(items, limit = 5) {
  const counts = new Map()
  for (const it of items || []) {
    for (const tag of safeTags(it)) {
      const key = String(tag || '').trim().toLowerCase()
      if (!key) continue
      counts.set(key, (counts.get(key) || 0) + 1)
    }
  }
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1
  const ranked = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      key,
      label: formatThemeLabel(key),
      count,
      pct: Math.round((count / total) * 100),
    }))
  if (limit == null || limit <= 0) return ranked
  return ranked.slice(0, limit)
}

/** Simple daily buckets for sparklines (last N days). */
export function buildDailySparkline(items, { days = 7, predicate } = {}) {
  const now = new Date()
  const buckets = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    buckets.push({ key, value: 0 })
  }
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]))
  for (const it of items || []) {
    if (!it?.created_at) continue
    if (predicate && !predicate(it)) continue
    const key = String(it.created_at).slice(0, 10)
    if (byKey[key]) byKey[key].value += 1
  }
  return buckets
}

export function sortInboxItems(items, sortBy, pinnedIds) {
  const arr = [...(items || [])]
  let sorted = arr
  if (sortBy === 'oldest') {
    sorted = arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  } else if (sortBy === 'priority') {
    sorted = arr.sort((a, b) => {
      const pa = Number(a?.priority ?? a?.impact_score ?? 0)
      const pb = Number(b?.priority ?? b?.impact_score ?? 0)
      if (pb !== pa) return pb - pa
      return new Date(b.created_at) - new Date(a.created_at)
    })
  } else {
    sorted = arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }
  if (!pinnedIds?.size) return sorted
  const pinned = []
  const rest = []
  for (const it of sorted) {
    const id = Number(it?.id)
    if (Number.isFinite(id) && pinnedIds.has(id)) pinned.push(it)
    else rest.push(it)
  }
  return [...pinned, ...rest]
}
