/**
 * Rank feedback that needs a human next step for the Overview "Needs attention" card.
 */

function priorityScore(item) {
  return Number(item?.priority ?? item?.impact_score ?? 0) || 0
}

function isReplied(item) {
  return Boolean(item?.replied_at)
}

function hasPolicyReview(item) {
  const matches = Array.isArray(item?.policy_matches) ? item.policy_matches : []
  return matches.some((m) => m && m.needs_review)
}

function ageHours(item, now = Date.now()) {
  const t = new Date(item?.created_at).getTime()
  if (!Number.isFinite(t)) return 0
  return Math.max(0, (now - t) / (1000 * 60 * 60))
}

/**
 * @returns {{ reasons: string[], score: number } | null}
 */
export function scoreNeedsAttention(item, now = Date.now()) {
  if (!item?.id) return null
  if (isReplied(item)) return null

  const sentiment = String(item?.sentiment_label || '').toLowerCase()
  const prio = priorityScore(item)
  const reasons = []
  let score = 0

  if (sentiment === 'negative') {
    reasons.push('Negative')
    score += 50
  }
  if (prio >= 80) {
    reasons.push('High priority')
    score += 40
  } else if (prio >= 50) {
    reasons.push('Medium priority')
    score += 15
  }
  if (hasPolicyReview(item)) {
    reasons.push('Policy review')
    score += 25
  }

  // Unreplied alone is not enough unless something else flags it.
  if (!reasons.length) return null

  const hours = ageHours(item, now)
  // Mild age bump so older unreplied items surface (cap ~12 pts at 3 days).
  score += Math.min(12, Math.floor(hours / 6))

  return { reasons, score }
}

/**
 * Merge recent + priority lists, score, and return top N action items.
 */
export function buildNeedsAttentionItems(lists, { limit = 5, now = Date.now() } = {}) {
  const byId = new Map()
  for (const list of lists || []) {
    for (const item of Array.isArray(list) ? list : []) {
      const id = Number(item?.id)
      if (!Number.isFinite(id)) continue
      const prev = byId.get(id)
      byId.set(id, prev ? { ...item, ...prev } : item)
    }
  }

  const ranked = []
  for (const item of byId.values()) {
    const scored = scoreNeedsAttention(item, now)
    if (!scored) continue
    ranked.push({ item, ...scored })
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const ta = new Date(a.item?.created_at).getTime() || 0
    const tb = new Date(b.item?.created_at).getTime() || 0
    return ta - tb
  })

  return ranked.slice(0, Math.max(1, limit))
}

export function formatAttentionAge(iso, now = Date.now()) {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const hours = Math.round((now - t) / (1000 * 60 * 60))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h open`
  const days = Math.floor(hours / 24)
  if (days === 1) return '1d open'
  if (days < 14) return `${days}d open`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
