import { buildInsightBrief } from '../../utils/insightsMetrics'
import { formatInsuranceTagChartLabel } from '../../utils/dashboardFormatters'
import { humanizeSource } from '../../utils/insightsMetrics'

export default function InsightBriefBanner({
  topThemes,
  sourcePerformance,
  metrics,
  insightsRange,
  selectedThemeKey,
  selectedSourceKey,
  onSelectTheme,
  onSelectSource,
}) {
  const brief = buildInsightBrief({
    topThemes,
    sourcePerformance,
    metrics,
    rangeDays: insightsRange,
  })

  return (
    <div className="rounded-3xl border border-emerald-100/70 bg-gradient-to-br from-emerald-50/80 via-white/95 to-white/90 px-4 sm:px-6 py-4 shadow-sm dark:border-emerald-900/30 dark:from-emerald-950/40 dark:via-gray-950/80 dark:to-gray-950/75">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800/80 dark:text-emerald-300/90">
        Insight brief · Last {insightsRange} days
      </p>
      <p className="mt-2 text-sm sm:text-base text-gray-800 dark:text-gray-100 leading-relaxed max-w-4xl">
        {brief.headline}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {brief.topRiskTheme ? (
          <button
            type="button"
            onClick={() => onSelectTheme?.(brief.topRiskTheme.key)}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#009750]/30 ${
              selectedThemeKey === brief.topRiskTheme.key
                ? 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100'
                : 'border-rose-200/80 bg-white/90 text-rose-800 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-gray-950/70 dark:text-rose-200'
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
                : 'border-amber-200/80 bg-white/90 text-amber-900 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-gray-950/70 dark:text-amber-200'
            }`}
          >
            Lowest sentiment: {humanizeSource(brief.lowestSource.source)}
          </button>
        ) : null}
        {(selectedThemeKey || selectedSourceKey) && (
          <span className="text-[11px] text-gray-500 dark:text-gray-400 self-center">
            {selectedThemeKey ? formatInsuranceTagChartLabel(selectedThemeKey) : ''}
            {selectedThemeKey && selectedSourceKey ? ' · ' : ''}
            {selectedSourceKey ? humanizeSource(selectedSourceKey) : ''} selected below
          </span>
        )}
      </div>
    </div>
  )
}
