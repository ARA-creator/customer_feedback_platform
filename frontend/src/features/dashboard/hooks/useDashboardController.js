import { useCallback, useMemo } from 'react'

/**
 * Small adapter hook that turns a pile of state/handlers into two stable objects:
 *  - `data`: read-only state for render
 *  - `actions`: things that cause side effects / mutations
 *
 * It’s intentionally boring. The fun part is deleting props later.
 */
export function useDashboardController(input) {
  const reload = useCallback(() => {
    input?.reload?.()
  }, [input])

  const refreshSilent = useCallback(() => {
    input?.refreshSilent?.()
  }, [input])

  const data = useMemo(() => {
    const {
      mode,
      isAdminUser,
      userRole,
      loading,
      analyticsLoading,
      inboxLoading,
      error,
      lastUpdated,

      // overview / analytics
      metrics,
      sentimentData,
      categoryData,
      trendData,
      responseMetrics,
      peakTimes,
      scoreHistogram,
      categoryTrends,
      productPulse,
      productPulseTrends,
      insuranceTagsBreakdown,
      insuranceTagsTrends,
      sourceTrends,
      sourcePerformance,

      // inbox lists + view state
      recentFeedback,
      priorityQueue,

      // detail modal
      selectedFeedback,
      isDetailOpen,
    } = input || {}

    return {
      mode,
      isAdminUser,
      userRole,
      loading,
      analyticsLoading,
      inboxLoading,
      error,
      lastUpdated,

      metrics,
      sentimentData,
      categoryData,
      trendData,
      responseMetrics,
      peakTimes,
      scoreHistogram,
      categoryTrends,
      productPulse,
      productPulseTrends,
      insuranceTagsBreakdown,
      insuranceTagsTrends,
      sourceTrends,
      sourcePerformance,

      recentFeedback,
      priorityQueue,

      selectedFeedback,
      isDetailOpen,
    }
  }, [input])

  const actions = useMemo(() => {
    return {
      // top-level refresh
      reload,
      refreshSilent,

      // navigation hooks (optional)
      navigateToInbox: input?.navigateToInbox,
      navigateToInsights: input?.navigateToInsights,
      navigateBack: input?.navigateBack,

      // modal controls (optional)
      openFeedback: input?.openFeedback,
      closeFeedback: input?.closeFeedback,
    }
  }, [input, reload, refreshSilent])

  return { data, actions }
}

