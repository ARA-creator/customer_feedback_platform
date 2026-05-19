export function formatInsuranceTagChartLabel(key) {
  if (key === 'no_insurance_tag') return 'No tag data'
  if (String(key || '').toLowerCase() === 'other') return 'Unclassified'
  const s = String(key || '')
    .replace(/_/g, ' ')
    .trim()
  if (!s) return 'Unknown'
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

export function formatCategoryChartLabel(name) {
  const raw = String(name || '').trim()
  if (!raw) return 'Unknown'
  if (raw.toLowerCase() === 'other') return 'Unclassified'
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function formatRelativeTime(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const sec = Math.round((Date.now() - t) / 1000)
  if (sec < 45) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 14) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatSentimentWord(label) {
  if (!label) return 'Unknown'
  const s = String(label).toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}
