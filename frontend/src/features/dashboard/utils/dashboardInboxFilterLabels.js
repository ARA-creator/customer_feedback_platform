import { formatSentimentWord } from './dashboardFormatters'

export function buildInboxActiveFilterLabels({
  mode,
  searchQuery,
  sentimentFilter,
  priorityFilter,
  sourceFilter,
  categoryFilter,
  dateRange,
}) {
  if (mode !== 'inbox') return []
  const parts = []
  const q = String(searchQuery || '').trim()
  if (q) parts.push(`Search: "${q.length > 36 ? `${q.slice(0, 36)}…` : q}"`)
  if (sentimentFilter && sentimentFilter !== 'all') parts.push(`Sentiment: ${formatSentimentWord(sentimentFilter)}`)
  if (priorityFilter === 'high') parts.push('High priority')
  if (sourceFilter && sourceFilter !== 'all') parts.push(`Source: ${sourceFilter}`)
  if (categoryFilter && categoryFilter !== 'all') parts.push(`Category: ${categoryFilter}`)
  if (dateRange && dateRange !== 'all') {
    const dr = { '7d': 'Last 7 days', '30d': 'Last 30 days', custom: 'Custom range' }
    parts.push(dr[dateRange] || `Dates: ${dateRange}`)
  }
  return parts
}

