import { useCallback } from 'react'

export function useDashboardActions({
  onNavigateToInbox,
  onNavigateScheduleReport,
  onNavigateCustomReport,
  pushToast,
}) {
  const navigateToInboxPreset = useCallback(
    ({ sentiment, priority }) => {
      onNavigateToInbox?.({
        sentiment: sentiment || 'all',
        priority: priority || 'all',
      })
    },
    [onNavigateToInbox],
  )

  const handleScheduleReports = useCallback(() => {
    if (onNavigateScheduleReport) return onNavigateScheduleReport()
    pushToast?.('Not available', 'Could not open the Schedule report page from here.', 'info')
    return undefined
  }, [onNavigateScheduleReport, pushToast])

  const handleOpenCustomReportBuilder = useCallback(() => {
    if (onNavigateCustomReport) return onNavigateCustomReport()
    pushToast?.('Not available', 'Could not open the Custom report page from here.', 'info')
    return undefined
  }, [onNavigateCustomReport, pushToast])

  return { navigateToInboxPreset, handleScheduleReports, handleOpenCustomReportBuilder }
}

