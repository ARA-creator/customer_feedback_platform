import { formatInsuranceTagChartLabel } from '../../utils/dashboardFormatters'
import { humanizeSource } from '../../utils/insightsMetrics'
import { buildCombinedPreset } from '../../utils/insightsInboxPreset'

export default function InsightsInvestigateBar({
  selectedThemeKey,
  selectedSourceKey,
  timeWindow = 'all',
  timeWindowLabel = 'All time',
  sentimentFilter = 'all',
  statusFilter = 'all',
  onClear,
  onNavigateToInbox,
}) {
  if (!selectedThemeKey && !selectedSourceKey) return null

  const parts = []
  if (selectedThemeKey) parts.push(formatInsuranceTagChartLabel(selectedThemeKey))
  if (selectedSourceKey) parts.push(humanizeSource(selectedSourceKey))
  parts.push(timeWindowLabel)
  if (sentimentFilter && sentimentFilter !== 'all') {
    parts.push(sentimentFilter.charAt(0).toUpperCase() + sentimentFilter.slice(1))
  }
  if (statusFilter === 'read' || statusFilter === 'replied') {
    parts.push(statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1))
  }

  const openInbox = () => {
    const preset = buildCombinedPreset({
      themeKey: selectedThemeKey,
      sourceKey: selectedSourceKey,
      timeWindow,
      sentiment: sentimentFilter || 'all',
      status: statusFilter || 'all',
    })
    if (preset) onNavigateToInbox?.(preset)
  }

  return (
    <div className="sticky top-2 z-10 flex flex-col gap-3 rounded-xl border border-[#009750]/20 bg-white/95 px-3.5 py-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900/40 dark:bg-gray-950/90">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#007a42] dark:text-emerald-300">
          Investigate
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
          {parts.join(' · ')}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={openInbox}
          className="rounded-lg bg-[#009750] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#007a42] focus:outline-none focus:ring-2 focus:ring-[#009750]/30"
        >
          Open inbox
        </button>
      </div>
    </div>
  )
}
