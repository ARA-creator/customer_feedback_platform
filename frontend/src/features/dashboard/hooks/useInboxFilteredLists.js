import { useMemo } from 'react'
import { buildSourceTabsFromItems, filterFeedbackItems } from '../utils/dashboardInboxFilters'

export function useInboxFilteredLists({
  recentFeedback,
  priorityQueue,
  filters,
  getStatus,
}) {
  return useMemo(() => {
    const allFeedback = [...(recentFeedback || []), ...(priorityQueue || [])]
    const sourceTabs = buildSourceTabsFromItems(allFeedback)
    const categoryOptions = Array.from(new Set(allFeedback.map((f) => f?.category).filter(Boolean))).sort()

    const filteredPriorityQueue = filterFeedbackItems(priorityQueue, filters, { ignoreSource: false })
    const filteredRecentFeedback = filterFeedbackItems(recentFeedback, filters, { ignoreSource: false })

    const visiblePriorityQueue = filteredPriorityQueue.filter((item) => getStatus(item) !== 'Archived')
    const visibleRecentFeedback = filteredRecentFeedback.filter((item) => getStatus(item) !== 'Archived')

    return {
      allFeedback,
      sourceTabs,
      categoryOptions,
      filteredPriorityQueue,
      filteredRecentFeedback,
      visiblePriorityQueue,
      visibleRecentFeedback,
    }
  }, [recentFeedback, priorityQueue, filters, getStatus])
}

