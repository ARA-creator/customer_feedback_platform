import { useEffect } from 'react'

function computeDateParams({ dateRange, customDateFrom, customDateTo }) {
  if (dateRange === 'custom') {
    return {
      date_from: customDateFrom || undefined,
      date_to: customDateTo || undefined,
    }
  }
  if (dateRange === '7d' || dateRange === '30d') {
    const days = dateRange === '7d' ? 7 : 30
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    return { date_from: from.toISOString(), date_to: undefined }
  }
  return { date_from: undefined, date_to: undefined }
}

export function useInboxSourceCounts({
  enabled,
  getSourceCounts,
  setServerSourceCounts,
  sentimentFilter,
  categoryFilter,
  priorityFilter,
  dateRange,
  customDateFrom,
  customDateTo,
}) {
  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    ;(async () => {
      try {
        const { date_from, date_to } = computeDateParams({ dateRange, customDateFrom, customDateTo })
        const data = await getSourceCounts({
          sentiment: sentimentFilter,
          category: categoryFilter === 'all' ? undefined : categoryFilter,
          priority: priorityFilter === 'high' ? 'high' : 'all',
          date_from,
          date_to,
        })
        if (!cancelled) setServerSourceCounts(data)
      } catch {
        if (!cancelled) setServerSourceCounts(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    enabled,
    getSourceCounts,
    setServerSourceCounts,
    sentimentFilter,
    categoryFilter,
    priorityFilter,
    dateRange,
    customDateFrom,
    customDateTo,
  ])
}

