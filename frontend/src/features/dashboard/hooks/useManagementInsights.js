import { useCallback, useMemo } from 'react'
import { computeManagementInsights } from '../utils/dashboardHelpers'

export function useManagementInsights({
  mode,
  overviewTimeFilter,
  comparison,
  highPriority,
  responseMetrics,
  analyticsDataRef,
}) {
  const managementInsights = useMemo(() => {
    const unknownCount = Number((analyticsDataRef?.current?.sentiment?.unknown ?? 0) || 0)
    return computeManagementInsights({
      mode,
      overviewTimeFilter,
      comparison,
      highPriority,
      responseMetrics,
      unknownSentimentCount: unknownCount,
    })
  }, [mode, overviewTimeFilter, comparison, highPriority, responseMetrics, analyticsDataRef])

  const getRelatedAlerts = useCallback(
    (kpiKey) => {
      const alerts = Array.isArray(managementInsights?.alerts) ? managementInsights.alerts : []
      if (!alerts.length) return []
      if (kpiKey === 'negative') return alerts.filter((a) => a.id === 'neg_share_spike' || a.id === 'hp_age')
      if (kpiKey === 'positive')
        return alerts.filter(
          (a) =>
            a.id === 'pos_share_spike' ||
            a.id === 'pos_share_drop' ||
            a.id === 'pos_volume_spike' ||
            a.id === 'pos_volume_drop',
        )
      return []
    },
    [managementInsights],
  )

  return { managementInsights, getRelatedAlerts }
}

