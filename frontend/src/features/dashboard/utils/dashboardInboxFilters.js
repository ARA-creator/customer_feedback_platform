export const CANONICAL_SOURCES = [
  'email',
  'web',
  'google_forms',
  'whatsapp',
  'x',
  'twitter',
  'tiktok',
  'instagram',
  'facebook',
]

export function normalizeSourceGroup(value) {
  const s = String(value || '').toLowerCase()
  if (!s) return ''
  if (s === 'email' || s.includes('mail')) return 'email'
  if (
    s === 'web' ||
    s.startsWith('web_') ||
    s.startsWith('web-') ||
    s.includes('webform') ||
    s.includes('web_form')
  )
    return 'web'
  if (s.includes('whatsapp')) return 'whatsapp'
  if (s === 'x' || s.includes('x_') || s.includes('x-') || s.includes('x ')) return 'x'
  if (s.includes('twitter')) return 'twitter'
  if (s.includes('tiktok')) return 'tiktok'
  if (s.includes('instagram')) return 'instagram'
  if (s.includes('facebook')) return 'facebook'
  return s
}

export function matchesDateRange({ createdAt, dateRange, customDateFrom, customDateTo }) {
  if (!createdAt) return true
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return true

  const now = new Date()
  if (dateRange === '7d') {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return created >= sevenDaysAgo
  }
  if (dateRange === '30d') {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    return created >= thirtyDaysAgo
  }
  if (dateRange === 'custom') {
    const fromOk = customDateFrom ? created >= new Date(customDateFrom) : true
    const toOk = customDateTo ? created <= new Date(customDateTo) : true
    return fromOk && toOk
  }
  return true
}

function matchesQuery(item, query) {
  if (!query) return true
  const q = String(query).trim().toLowerCase()
  if (!q) return true
  const inMessage = String(item?.message || item?.message_preview || '').toLowerCase().includes(q)
  const inCustomerId = String(item?.customer_id || '').toLowerCase().includes(q)
  const inCategory = String(item?.category || '').toLowerCase().includes(q)
  return inMessage || inCustomerId || inCategory
}

export function filterFeedbackItems(items, filters, { ignoreSource = false } = {}) {
  const rows = Array.isArray(items) ? items : []
  const {
    searchQuery,
    sentimentFilter,
    sourceFilter,
    categoryFilter,
    priorityFilter,
    dateRange,
    customDateFrom,
    customDateTo,
  } = filters || {}

  return rows.filter((item) => {
    if (!matchesQuery(item, searchQuery)) return false

    if (sentimentFilter && sentimentFilter !== 'all') {
      if (String(item?.sentiment_label || '').toLowerCase() !== String(sentimentFilter).toLowerCase()) return false
    }

    if (!ignoreSource && sourceFilter && sourceFilter !== 'all') {
      const sf = String(sourceFilter).toLowerCase()
      const src = String(item?.source || '').toLowerCase()
      if (CANONICAL_SOURCES.includes(sf)) {
        if (normalizeSourceGroup(src) !== sf) return false
      } else {
        if (src !== sf) return false
      }
    }

    if (categoryFilter && categoryFilter !== 'all') {
      if (String(item?.category || '').toLowerCase() !== String(categoryFilter).toLowerCase()) return false
    }

    if (priorityFilter === 'high') {
      if (!item?.priority || Number(item.priority) < 80) return false
    }

    if (
      !matchesDateRange({
        createdAt: item?.created_at,
        dateRange,
        customDateFrom,
        customDateTo,
      })
    )
      return false

    return true
  })
}

export function buildSourceTabsFromItems(items) {
  const rows = Array.isArray(items) ? items : []
  const sourceOptions = Array.from(new Set(rows.map((f) => f?.source).filter(Boolean))).sort()
  return [...CANONICAL_SOURCES, ...sourceOptions.map((s) => String(s).toLowerCase())]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort((a, b) => {
      const ai = CANONICAL_SOURCES.indexOf(a)
      const bi = CANONICAL_SOURCES.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
}

