/** Client-side inbox analytics derived from the loaded feed. */

function safeTags(item) {
  const raw = item?.insurance_tags || item?.channel_metadata?.insurance_tags
  return Array.isArray(raw) ? raw : []
}

export function extractFeedbackTitle(item) {
  const msg = String(item?.message || item?.message_preview || '').trim()
  if (!msg) return 'Feedback'
  const line = msg.split('\n').find((l) => l.trim()) || msg
  const t = line.trim()
  return t.length > 72 ? `${t.slice(0, 72)}…` : t
}

export function getPriorityBadge(item) {
  const score = Number(item?.priority ?? item?.impact_score ?? 0)
  if (score >= 80) return { label: 'High', tone: 'high' }
  if (score >= 50) return { label: 'Medium', tone: 'medium' }
  return { label: 'New', tone: 'new' }
}

export function isHighPriority(item) {
  const score = Number(item?.priority ?? item?.impact_score ?? 0)
  return score >= 80
}

export function needsResponse(item) {
  const s = String(item?.sentiment_label || '').toLowerCase()
  return s === 'negative' || isHighPriority(item)
}

/**
 * Stable unread count for the current inbox filter.
 * Uses server total when available; unloaded rows count as unread until marked read.
 */
export function computeStableUnreadCount({ total, scopedIds, readIds, loadedItems }) {
  const totalN = Number(total)
  const scoped = scopedIds?.size ? scopedIds : null
  if (Number.isFinite(totalN) && totalN >= 0 && scoped) {
    // Full feed loaded for current filters — exact unread from scoped ids.
    if (scoped.size >= totalN) {
      let unread = 0
      for (const id of scoped) {
        if (!readIds?.has?.(id)) unread += 1
      }
      return unread
    }
    if (totalN > 0) {
      let readKnown = 0
      for (const id of scoped) {
        if (readIds?.has?.(id)) readKnown += 1
      }
      const known = scoped.size
      const unreadKnown = known - readKnown
      const unreadUnknown = Math.max(0, totalN - known)
      return unreadUnknown + unreadKnown
    }
  }
  const arr = Array.isArray(loadedItems) ? loadedItems : []
  return arr.filter((it) => !readIds?.has?.(it?.id)).length
}

export function computeInboxStats(items, { readIds, folder }) {
  const arr = Array.isArray(items) ? items : []
  const inboxItems = folder === 'archive' ? arr : arr
  let high = 0
  let negative = 0
  let unread = 0
  for (const it of inboxItems) {
    if (!readIds?.has?.(it?.id)) unread += 1
    if (isHighPriority(it)) high += 1
    if (String(it?.sentiment_label || '').toLowerCase() === 'negative') negative += 1
  }
  const total = inboxItems.length
  const negativePct = total > 0 ? Math.round((negative / total) * 100) : 0

  return {
    newCount: unread,
    highPriorityCount: high,
    negativePct,
    avgResponseLabel: '—',
    total,
  }
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
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
      pct: Math.round((count / total) * 100),
    }))
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

export function sortInboxItems(items, sortBy) {
  const arr = [...(items || [])]
  if (sortBy === 'oldest') {
    return arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  }
  if (sortBy === 'priority') {
    return arr.sort((a, b) => {
      const pa = Number(a?.priority ?? a?.impact_score ?? 0)
      const pb = Number(b?.priority ?? b?.impact_score ?? 0)
      if (pb !== pa) return pb - pa
      return new Date(b.created_at) - new Date(a.created_at)
    })
  }
  return arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}
