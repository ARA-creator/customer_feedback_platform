import { useCallback, useMemo } from 'react'

export function useInboxQuickFilters({
  mode,
  searchQuery,
  setSearchQuery,
  sentimentFilter,
  setSentimentFilter,
  sourceFilter,
  setSourceFilter,
  categoryFilter,
  setCategoryFilter,
  priorityFilter,
  setPriorityFilter,
  dateRange,
  setDateRange,
  customDateFrom,
  setCustomDateFrom,
  customDateTo,
  setCustomDateTo,
  buildInboxActiveFilterLabels,
  getQuickFilterPatch,
  SAVED_VIEWS,
}) {
  const handleQuickFilter = useCallback((type) => {
    const patch = getQuickFilterPatch(type)
    if (!patch) return
    if (patch.searchQuery != null) setSearchQuery(patch.searchQuery)
    if (patch.sentimentFilter != null) setSentimentFilter(patch.sentimentFilter)
    if (patch.sourceFilter != null) setSourceFilter(patch.sourceFilter)
    if (patch.categoryFilter != null) setCategoryFilter(patch.categoryFilter)
    if (patch.priorityFilter != null) setPriorityFilter(patch.priorityFilter)
    if (patch.dateRange != null) setDateRange(patch.dateRange)
    if (patch.customDateFrom != null) setCustomDateFrom(patch.customDateFrom)
    if (patch.customDateTo != null) setCustomDateTo(patch.customDateTo)
  }, [
    getQuickFilterPatch,
    setCategoryFilter,
    setCustomDateFrom,
    setCustomDateTo,
    setDateRange,
    setPriorityFilter,
    setSearchQuery,
    setSentimentFilter,
    setSourceFilter,
  ])

  const inboxActiveFilterLabels = useMemo(() => {
    return buildInboxActiveFilterLabels({
      mode,
      searchQuery,
      sentimentFilter,
      priorityFilter,
      sourceFilter,
      categoryFilter,
      dateRange,
    })
  }, [buildInboxActiveFilterLabels, categoryFilter, dateRange, mode, priorityFilter, searchQuery, sentimentFilter, sourceFilter])

  const savedViews = useMemo(
    () =>
      SAVED_VIEWS.map((v) => ({
        ...v,
        apply: () => handleQuickFilter(v.quickFilter),
      })),
    [SAVED_VIEWS, handleQuickFilter],
  )

  const inboxHasActiveFilters = inboxActiveFilterLabels.length > 0

  return { handleQuickFilter, inboxActiveFilterLabels, inboxHasActiveFilters, savedViews }
}

