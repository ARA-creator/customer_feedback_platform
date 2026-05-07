export const QUICK_FILTERS = {
  clear: () => ({
    searchQuery: '',
    sentimentFilter: 'all',
    sourceFilter: 'all',
    categoryFilter: 'all',
    priorityFilter: 'all',
    dateRange: 'all',
    customDateFrom: '',
    customDateTo: '',
  }),
  high_priority: () => ({
    priorityFilter: 'high',
    dateRange: 'all',
  }),
  this_week: () => ({
    dateRange: '7d',
  }),
  web_mentions: () => ({
    sourceFilter: 'web',
  }),
  negative_7d: () => ({
    sentimentFilter: 'negative',
    dateRange: '7d',
  }),
  web_7d: () => ({
    sourceFilter: 'web',
    dateRange: '7d',
  }),
  unresolved: () => ({
    priorityFilter: 'high',
    sentimentFilter: 'negative',
    dateRange: '30d',
  }),
}

export function getQuickFilterPatch(type) {
  const t = String(type || '').trim()
  const fn = QUICK_FILTERS[t]
  return fn ? fn() : null
}

