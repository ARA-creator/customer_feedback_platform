import { formatInsuranceTagChartLabel } from '../../utils/dashboardFormatters'
import { humanizeSource } from '../../utils/insightsMetrics'
import { buildCombinedPreset } from '../../utils/insightsInboxPreset'

export default function InsightsInvestigateBar({
  selectedThemeKey,
  selectedSourceKey,
  insightsRange,
  onClear,
  onNavigateToInbox,
  negativeOnly,
  onToggleNegativeOnly,
}) {
  if (!selectedThemeKey && !selectedSourceKey) return null

  const parts = []
  if (selectedThemeKey) parts.push(formatInsuranceTagChartLabel(selectedThemeKey))
  if (selectedSourceKey) parts.push(humanizeSource(selectedSourceKey))
  parts.push(`Last ${insightsRange}d`)

  const openInbox = () => {
    const preset = buildCombinedPreset({
      themeKey: selectedThemeKey,
      sourceKey: selectedSourceKey,
      rangeDays: insightsRange,
      sentiment: negativeOnly ? 'negative' : 'all',
    })
    if (preset) onNavigateToInbox?.(preset)
  }

  return (
    <div className="sticky top-0 z-10 rounded-2xl border border-[#009750]/25 bg-emerald-50/90 dark:bg-emerald-950/40 px-4 py-3 shadow-sm backdrop-blur-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
          Investigate
        </p>
        <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{parts.join(' · ')}</p>
        {insightsRange === 90 ? (
          <p className="mt-0.5 text-[10px] text-gray-600 dark:text-gray-400">Inbox opens with 30-day filter (90d not yet in inbox).</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onToggleNegativeOnly?.()}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
            negativeOnly
              ? 'border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100'
              : 'border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
          }`}
        >
          {negativeOnly ? 'Negative only' : 'All sentiment'}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={openInbox}
          className="rounded-lg bg-[#009750] px-4 py-2 text-xs font-semibold text-white hover:bg-[#007a42] focus:outline-none focus:ring-2 focus:ring-[#009750]/30"
        >
          Open inbox
        </button>
      </div>
    </div>
  )
}
