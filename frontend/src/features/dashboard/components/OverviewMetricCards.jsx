import { FiBarChart2, FiMinus, FiThumbsDown, FiThumbsUp } from 'react-icons/fi'
import { kpiChangeText } from '../utils/dashboardHelpers'

/**
 * Overview KPI strip (total, sentiment breakdown) with WoW popovers.
 */
export default function OverviewMetricCards({
  metrics,
  kpiTrackPercent,
  analyticsLoading,
  analyticsDelayPassed,
  activeKpiChange,
  setActiveKpiChange,
  onKpiPointerEnter,
  onKpiPointerLeave,
  managementInsights,
  navigateToInboxPreset,
}) {
  const loading = analyticsLoading || !analyticsDelayPassed

  const kpiPopover = (key, deltaAbs, deltaPct) =>
    activeKpiChange === key ? (
      <div
        className="absolute z-50 left-1/2 top-full mt-2 w-max max-w-[200px] -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 shadow-md dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        role="status"
        aria-live="polite"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {kpiChangeText(deltaAbs, deltaPct) || 'No comparison for this period'}
      </div>
    ) : null

  return (
    <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 xl:gap-6">
      {loading ? (
        <>
          {['metric-card--tint-total', 'metric-card--tint-negative', 'metric-card--tint-positive', 'metric-card--tint-neutral'].map(
            (tintClass, idx) => (
              <div key={idx} className={`metric-card metric-card--kpi ${tintClass} animate-pulse`}>
                <div className="metric-card__body">
                  <div className="h-10 w-10 rounded-full bg-black/[0.06] dark:bg-white/[0.12]" />
                  <div className="metric-card__text w-full min-w-0">
                    <div className="h-8 w-16 rounded-md bg-black/[0.07] dark:bg-white/[0.1]" />
                    <div className="mt-2 h-3 w-24 rounded bg-black/[0.05] dark:bg-white/[0.08]" />
                  </div>
                </div>
                <div className="metric-card__footer">
                  <div className="h-0.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.10]">
                    <div className="h-full w-1/3 rounded-full bg-black/[0.1] dark:bg-white/[0.16]" />
                  </div>
                </div>
              </div>
            ),
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            className="metric-card metric-card--kpi metric-card--tint-total w-full cursor-pointer text-left"
            style={{ '--kpi-pct': `${kpiTrackPercent.total}%` }}
            aria-label="View all feedback in inbox"
            onPointerEnter={onKpiPointerEnter('total')}
            onPointerLeave={onKpiPointerLeave()}
            onFocus={() => setActiveKpiChange('total')}
            onBlur={() => setActiveKpiChange(null)}
            onClick={(e) => {
              e.stopPropagation()
              if (activeKpiChange !== 'total') {
                setActiveKpiChange('total')
                return
              }
              setActiveKpiChange(null)
              navigateToInboxPreset({ sentiment: 'all', priority: 'all' })
            }}
          >
            <div className="relative w-full">
              <div className="metric-card__body">
                <div className="metric-card__icon" aria-hidden>
                  <FiBarChart2 className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <div className="metric-card__text">
                  <p className="metric-card__value">{metrics.totalFeedback}</p>
                  <p className="metric-card__label">Total Feedback</p>
                </div>
              </div>
              <div className="metric-card__footer">
                <div className="metric-card__track" aria-hidden>
                  <div className="metric-card__track-fill" />
                </div>
              </div>
              {kpiPopover('total', managementInsights?.deltas?.total?.abs, managementInsights?.deltas?.total?.pct)}
            </div>
          </button>

          <button
            type="button"
            className="metric-card metric-card--kpi metric-card--tint-negative w-full cursor-pointer text-left"
            style={{ '--kpi-pct': `${kpiTrackPercent.negative}%` }}
            aria-label="View negative feedback in inbox"
            onPointerEnter={onKpiPointerEnter('negative')}
            onPointerLeave={onKpiPointerLeave()}
            onFocus={() => setActiveKpiChange('negative')}
            onBlur={() => setActiveKpiChange(null)}
            onClick={(e) => {
              e.stopPropagation()
              if (activeKpiChange !== 'negative') {
                setActiveKpiChange('negative')
                return
              }
              setActiveKpiChange(null)
              navigateToInboxPreset({ sentiment: 'negative', priority: 'all' })
            }}
          >
            <div className="relative w-full">
              <div className="metric-card__body">
                <div className="metric-card__icon" aria-hidden>
                  <FiThumbsDown className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <div className="metric-card__text">
                  <p className="metric-card__value">{metrics.negative}</p>
                  <p className="metric-card__label">Negative</p>
                </div>
              </div>
              <div className="metric-card__footer">
                <div className="metric-card__track" aria-hidden>
                  <div className="metric-card__track-fill" />
                </div>
              </div>
              {kpiPopover('negative', managementInsights?.deltas?.negative?.abs, managementInsights?.deltas?.negative?.pct)}
            </div>
          </button>

          <button
            type="button"
            className="metric-card metric-card--kpi metric-card--tint-positive w-full cursor-pointer text-left"
            style={{ '--kpi-pct': `${kpiTrackPercent.positive}%` }}
            aria-label="View positive feedback in inbox"
            onPointerEnter={onKpiPointerEnter('positive')}
            onPointerLeave={onKpiPointerLeave()}
            onFocus={() => setActiveKpiChange('positive')}
            onBlur={() => setActiveKpiChange(null)}
            onClick={(e) => {
              e.stopPropagation()
              if (activeKpiChange !== 'positive') {
                setActiveKpiChange('positive')
                return
              }
              setActiveKpiChange(null)
              navigateToInboxPreset({ sentiment: 'positive', priority: 'all' })
            }}
          >
            <div className="relative w-full">
              <div className="metric-card__body">
                <div className="metric-card__icon" aria-hidden>
                  <FiThumbsUp className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <div className="metric-card__text">
                  <p className="metric-card__value">{metrics.positive}</p>
                  <p className="metric-card__label">Positive</p>
                </div>
              </div>
              <div className="metric-card__footer">
                <div className="metric-card__track" aria-hidden>
                  <div className="metric-card__track-fill" />
                </div>
              </div>
              {kpiPopover('positive', managementInsights?.deltas?.positive?.abs, managementInsights?.deltas?.positive?.pct)}
            </div>
          </button>

          <button
            type="button"
            className="metric-card metric-card--kpi metric-card--tint-neutral w-full cursor-pointer text-left"
            style={{ '--kpi-pct': `${kpiTrackPercent.neutral}%` }}
            aria-label="View neutral feedback in inbox"
            onPointerEnter={onKpiPointerEnter('neutral')}
            onPointerLeave={onKpiPointerLeave()}
            onFocus={() => setActiveKpiChange('neutral')}
            onBlur={() => setActiveKpiChange(null)}
            onClick={(e) => {
              e.stopPropagation()
              if (activeKpiChange !== 'neutral') {
                setActiveKpiChange('neutral')
                return
              }
              setActiveKpiChange(null)
              navigateToInboxPreset({ sentiment: 'neutral', priority: 'all' })
            }}
          >
            <div className="relative w-full">
              <div className="metric-card__body">
                <div className="metric-card__icon" aria-hidden>
                  <FiMinus className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <div className="metric-card__text">
                  <p className="metric-card__value">{metrics.neutral}</p>
                  <p className="metric-card__label">Neutral</p>
                </div>
              </div>
              <div className="metric-card__footer">
                <div className="metric-card__track" aria-hidden>
                  <div className="metric-card__track-fill" />
                </div>
              </div>
              {kpiPopover('neutral', managementInsights?.deltas?.neutral?.abs, managementInsights?.deltas?.neutral?.pct)}
            </div>
          </button>
        </>
      )}
    </div>
  )
}
