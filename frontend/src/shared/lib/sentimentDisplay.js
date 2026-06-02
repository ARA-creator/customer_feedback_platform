import { FiMinus, FiThumbsDown, FiThumbsUp } from 'react-icons/fi'

/** Normalize sentiment from API rows (label field and/or score). */
export function sentimentLabelFromItem(item) {
  if (!item || typeof item !== 'object') return ''
  const raw =
    item.sentiment_label ?? item.sentimentLabel ?? item.sentiment ?? ''
  const s = String(raw).trim().toLowerCase()
  if (s === 'positive' || s === 'negative' || s === 'neutral') return s
  if (s === 'very_positive' || s.startsWith('positive')) return 'positive'
  if (s === 'very_negative' || s.startsWith('negative')) return 'negative'
  if (s.startsWith('neutral')) return 'neutral'

  const score = Number(item.sentiment_score)
  if (Number.isFinite(score)) {
    if (score >= 0.05) return 'positive'
    if (score <= -0.05) return 'negative'
    return 'neutral'
  }
  return ''
}

export function resolveSentimentKind(labelOrItem) {
  const s =
    typeof labelOrItem === 'object'
      ? sentimentLabelFromItem(labelOrItem)
      : String(labelOrItem || '').trim().toLowerCase()
  if (s === 'positive') return 'positive'
  if (s === 'negative') return 'negative'
  return 'neutral'
}

export function itemMatchesSentimentFilter(item, filter) {
  const f = String(filter || 'all').toLowerCase()
  if (!f || f === 'all') return true
  return resolveSentimentKind(item) === f
}

/** Primary sentiment glyphs: thumbs up / down / minus (neutral). */
export function getSentimentIcon(labelOrItem) {
  const kind = resolveSentimentKind(labelOrItem)
  if (kind === 'positive') return FiThumbsUp
  if (kind === 'negative') return FiThumbsDown
  return FiMinus
}

export function sentimentAvatarRingClass(labelOrItem) {
  const kind = resolveSentimentKind(labelOrItem)
  if (kind === 'positive') {
    return 'bg-emerald-50 ring-1 ring-emerald-100/80 dark:bg-emerald-950/40 dark:ring-emerald-900/50'
  }
  if (kind === 'negative') {
    return 'bg-rose-50 ring-1 ring-rose-100/80 dark:bg-rose-950/40 dark:ring-rose-900/50'
  }
  return 'bg-amber-50 ring-1 ring-amber-100/80 dark:bg-amber-950/40 dark:ring-amber-900/50'
}

export function sentimentIconGlyphClass(labelOrItem) {
  const kind = resolveSentimentKind(labelOrItem)
  if (kind === 'positive') return 'text-emerald-600 dark:text-emerald-400'
  if (kind === 'negative') return 'text-rose-600 dark:text-rose-400'
  return 'text-amber-700 dark:text-amber-400'
}
