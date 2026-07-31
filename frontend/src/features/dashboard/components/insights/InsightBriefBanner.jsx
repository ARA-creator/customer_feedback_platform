import { buildInsightBrief } from '../../utils/insightsMetrics'
import { formatInsuranceTagChartLabel } from '../../utils/dashboardFormatters'
import { humanizeSource } from '../../utils/insightsMetrics'

export default function InsightBriefBanner({
  topThemes,
  sourcePerformance,
  metrics,
  timeWindowLabel = 'All time',
  selectedThemeKey,
  selectedSourceKey,
  onSelectTheme,
  onSelectSource,
}) {
  const brief = buildInsightBrief({
    topThemes,
    sourcePerformance,
    metrics,
    rangeLabel: timeWindowLabel,
  })

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#009750]/15 bg-[#f4faf6] px-4 py-4 sm:px-5 dark:border-emerald-900/40 dark:bg-emerald-950/25">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[#009750]"
        aria-hidden
      />
      <p className="pl-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#007a42] dark:text-emerald-300/90">
        Brief · {timeWindowLabel}
      </p>
      <p className="mt-2 pl-2 text-sm leading-relaxed text-gray-800 dark:text-gray-100 sm:text-[15px] max-w-3xl">
        {brief.headline}
      </p>
      {(brief.topRiskTheme || brief.lowestSource) && (
        <div className="mt-3 flex flex-wrap gap-2 pl-2">
          {brief.topRiskTheme ? (
            <button
              type="button"
              onClick={() => onSelectTheme?.(brief.topRiskTheme.key)}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#009750]/30 ${
                selectedThemeKey === brief.topRiskTheme.key
                  ? 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100'
                  : 'border-rose-200/70 bg-white text-rose-800 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-gray-950/70 dark:text-rose-200'
              }`}
            >
              Top risk: {brief.topRiskTheme.label}
            </button>
          ) : null}
          {brief.lowestSource ? (
            <button
              type="button"
              onClick={() => onSelectSource?.(brief.lowestSource.source)}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#009750]/30 ${
                selectedSourceKey === brief.lowestSource.source
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100'
                  : 'border-amber-200/70 bg-white text-amber-900 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-gray-950/70 dark:text-amber-200'
              }`}
            >
              Lowest sentiment: {humanizeSource(brief.lowestSource.source)}
            </button>
          ) : null}
          {(selectedThemeKey || selectedSourceKey) && (
            <span className="self-center text-[11px] text-gray-500 dark:text-gray-400">
              {selectedThemeKey ? formatInsuranceTagChartLabel(selectedThemeKey) : ''}
              {selectedThemeKey && selectedSourceKey ? ' · ' : ''}
              {selectedSourceKey ? humanizeSource(selectedSourceKey) : ''} selected
            </span>
          )}
        </div>
      )}
    </div>
  )
}
