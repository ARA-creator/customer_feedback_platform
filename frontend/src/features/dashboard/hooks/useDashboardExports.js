import { useCallback } from 'react'

import { downloadAnalystExportCsv } from '../../reports/services/reports.api'
import { downloadBlob } from '../utils/dashboardExport'

export function useDashboardExports({
  exportParams,
  buildInboxFeedbackCsv,
  downloadTextFile,
  pushToast,
  recentFeedback,
  priorityQueue,
}) {
  const exportOverviewCsv = useCallback(async () => {
    try {
      const res = await downloadAnalystExportCsv(exportParams || {})
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const disposition = res.headers?.['content-disposition'] || ''
      const match = /filename="([^"]+)"/.exec(disposition)
      const filename = match?.[1] || `feedback_export_${new Date().toISOString().slice(0, 10)}.csv`
      downloadBlob({ blob, filename })
      pushToast?.('Export ready', 'Feedback CSV downloaded.', 'success')
    } catch (err) {
      console.error('Failed to export CSV', err)
      pushToast?.(
        'Export failed',
        err?.response?.data?.error || 'Could not build the export. Try again.',
        'error',
      )
    }
  }, [exportParams, pushToast])

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

