import { useCallback } from 'react'

export function useDashboardExports({
  metrics,
  sentimentData,
  categoryData,
  trendData,
  overviewPeriod,
  recentFeedback,
  priorityQueue,
  buildDashboardSummaryCsv,
  buildInboxFeedbackCsv,
  downloadTextFile,
  pushToast,
}) {
  const exportOverviewCsv = useCallback(() => {
    try {
      const csv = buildDashboardSummaryCsv({
        metrics,
        sentimentData,
        categoryData,
        trendData,
        periodLabel: overviewPeriod?.label,
        trendExportHeader: overviewPeriod?.trend?.exportHeader,
      })
      const suffix = overviewPeriod?.exportFilenameSuffix || 'overview'
      downloadTextFile({
        contents: csv,
        filename: `feedback_dashboard_${suffix}_${new Date().toISOString().slice(0, 10)}.csv`,
        mime: 'text/csv;charset=utf-8;',
      })
      pushToast?.('Export ready', 'Dashboard summary CSV downloaded.', 'success')
    } catch (err) {
      console.error('Failed to export CSV', err)
      pushToast?.('Export failed', 'Could not build the CSV. Try again.', 'error')
    }
  }, [
    buildDashboardSummaryCsv,
    categoryData,
    downloadTextFile,
    metrics,
    pushToast,
    sentimentData,
    trendData,
    overviewPeriod,
  ])

  const exportInboxCsv = useCallback(() => {
    const rows = recentFeedback?.length > 0 ? recentFeedback : priorityQueue
    if (!rows || rows.length === 0) {
      pushToast?.(
        'Nothing to export',
        'No feedback matches the current filters. Clear filters or widen the date range.',
        'info',
      )
      return
    }

    try {
      const csv = buildInboxFeedbackCsv(rows)
      downloadTextFile({ contents: csv, filename: 'feedback_export.csv', mime: 'text/csv;charset=utf-8;' })
      pushToast?.('Export ready', 'Inbox feedback CSV downloaded.', 'success')
    } catch (err) {
      console.error('Failed to export CSV:', err)
      pushToast?.('Export failed', 'Unable to export CSV in this environment.', 'error')
    }
  }, [buildInboxFeedbackCsv, downloadTextFile, priorityQueue, pushToast, recentFeedback])

  return { exportOverviewCsv, exportInboxCsv }
}

