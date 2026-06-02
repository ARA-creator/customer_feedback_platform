import { FiMinus, FiThumbsDown, FiThumbsUp } from 'react-icons/fi'

export function resolveSentimentKind(label) {
  const s = String(label || '').toLowerCase()
  if (s === 'positive') return 'positive'
  if (s === 'negative') return 'negative'
  return 'neutral'
}

/** Primary sentiment glyphs: thumbs up / down / minus (neutral). */
export function getSentimentIcon(label) {
  const kind = resolveSentimentKind(label)
  if (kind === 'positive') return FiThumbsUp
  if (kind === 'negative') return FiThumbsDown
  return FiMinus
}

export function sentimentAvatarRingClass(label) {
  const kind = resolveSentimentKind(label)
  if (kind === 'positive') {
    return 'bg-emerald-50 ring-1 ring-emerald-100/80 dark:bg-emerald-950/40 dark:ring-emerald-900/50'
  }
  if (kind === 'negative') {
    return 'bg-rose-50 ring-1 ring-rose-100/80 dark:bg-rose-950/40 dark:ring-rose-900/50'
  }
  return 'bg-amber-50 ring-1 ring-amber-100/80 dark:bg-amber-950/40 dark:ring-amber-900/50'
}

export function sentimentIconGlyphClass(label) {
  const kind = resolveSentimentKind(label)
  if (kind === 'positive') return 'text-emerald-600 dark:text-emerald-400'
  if (kind === 'negative') return 'text-rose-600 dark:text-rose-400'
  return 'text-amber-700 dark:text-amber-400'
}
