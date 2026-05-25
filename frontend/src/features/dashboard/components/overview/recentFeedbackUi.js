import { formatSentimentWord } from '../../utils/dashboardFormatters'
import { humanizeSource } from '../../utils/insightsMetrics'

export function formatFeedbackListDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function sentimentEmoji(label) {
  const s = String(label || '').toLowerCase()
  if (s === 'positive') return '😊'
  if (s === 'negative') return '😞'
  return '😐'
}

export function sentimentIconStyles(label) {
  const s = String(label || '').toLowerCase()
  if (s === 'positive') {
    return 'bg-emerald-50 ring-1 ring-emerald-100/80 dark:bg-emerald-950/40 dark:ring-emerald-900/50'
  }
  if (s === 'negative') {
    return 'bg-rose-50 ring-1 ring-rose-100/80 dark:bg-rose-950/40 dark:ring-rose-900/50'
  }
  return 'bg-amber-50 ring-1 ring-amber-100/80 dark:bg-amber-950/40 dark:ring-amber-900/50'
}

export function categoryPillClass(category) {
  const c = String(category || '').toLowerCase()
  if (c.includes('bug') || c.includes('complaint')) {
    return 'bg-rose-50 text-rose-700 ring-1 ring-rose-100 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-900/40'
  }
  if (c.includes('compliment') || c.includes('praise')) {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900/40'
  }
  if (c.includes('feature')) {
    return 'bg-sky-50 text-sky-700 ring-1 ring-sky-100 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900/40'
  }
  return 'bg-gray-50 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700'
}

export function feedbackCategoryLabel(item) {
  const cat = String(item?.category || '').toLowerCase()
  if (cat.includes('bug')) return 'Bug'
  if (cat.includes('compliment') || cat.includes('praise')) return 'Compliment'
  if (cat.includes('feature')) return 'Feature Request'
  if (cat.includes('complaint')) return 'Complaint'
  const raw = String(item?.category || '').trim()
  if (raw) {
    return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return 'Feedback'
}

export function feedbackMetaLine(item) {
  const source = humanizeSource(item?.source)
  const date = formatFeedbackListDate(item?.created_at)
  const sentiment = formatSentimentWord(item?.sentiment_label)
  return `${source} · ${date} · ${sentiment}`
}
