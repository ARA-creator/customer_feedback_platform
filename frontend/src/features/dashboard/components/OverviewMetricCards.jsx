import {
  FiAlertTriangle,
  FiBarChart2,
  FiMinus,
  FiThumbsDown,
  FiThumbsUp,
} from 'react-icons/fi'
import { kpiChangeText } from '../utils/dashboardHelpers'

/**
 * Overview KPI strip (total, sentiment breakdown, high priority) with WoW popovers.
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
  getRelatedAlerts,
  navigateToInboxPreset,
}) {
  const loading = analyticsLoading || !analyticsDelayPassed

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      {loading ? (
        <>
          {[
            'metric-card--tint-total',
            'metric-card--tint-negative',
            'metric-card--tint-positive',
            'metric-card--tint-neutral',
            'metric-card--tint-priority',
          ].map((tintClass, idx) => (
            <div key={idx} className={`metric-card metric-card--kpi ${tintClass} animate-pulse`}>
              <div className="metric-card__body">
                <div className="h-10 w-10 rounded-full bg-black/[0.06] dark:bg-white/[0.12]" />
                <div className="metric-card__text w-full min-w-0">
                  <div className="h-8 w-16 rounded-md bg-black/[0.07] dark:bg-white/[0.1]" />
                  <div className="mt-2 h-3 w-24 rounded bg-black/[0.05] dark:bg-white/[0.08]" />
                </div>
              </div>
              <div className="metric-card__footer">
                <div className="h-0.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.1]">
                  <div className="h-full w-1/3 rounded-full bg-black/[0.1] dark:bg-white/[0.16]" />
                </div>
              </div>
            </div>
          ))}
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
              {activeKpiChange === 'total' && (
                <div
                  className="absolute z-50 left-1/2 top-full mt-2 w-[220px] -translate-x-1/2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-semibold text-gray-800 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  role="status"
                  aria-live="polite"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div>
                    {kpiChangeText(managementInsights?.deltas?.total?.abs, managementInsights?.deltas?.total?.pct) ||
                      'No comparison available'}
                  </div>
                </div>
              )}
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
              {activeKpiChange === 'negative' && (
                <div
                  className="absolute z-50 left-1/2 top-full mt-2 w-[220px] -translate-x-1/2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-semibold text-gray-800 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  role="status"
                  aria-live="polite"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div>
                    {kpiChangeText(
                      managementInsights?.deltas?.negative?.abs,
                      managementInsights?.deltas?.negative?.pct,
                    ) || 'No comparison available'}
                  </div>
                  {getRelatedAlerts('negative').map((a) => {
                    const alertShell =
                      a.variant === 'warning'
                        ? 'border-amber-100 bg-amber-50 text-amber-900'
                        : a.variant === 'error'
                          ? 'border-red-100 bg-red-50 text-red-900'
                          : 'border-blue-100 bg-blue-50 text-blue-900'
                    const alertText =
                      a.variant === 'warning'
                        ? 'text-amber-800'
                        : a.variant === 'error'
                          ? 'text-red-800'
                          : 'text-blue-800'
                    return (
                      <div
                        key={a.id}
                        className={`mt-2 rounded-lg border px-2 py-1 text-[11px] ${alertShell}`}
                      >
                        <span className="font-semibold">{a.title}</span>
                        {a.message ? <span className={`font-medium ${alertText}`}> · {a.message}</span> : null}
                      </div>
                    )
                  })}
                </div>
              )}
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
              {activeKpiChange === 'positive' && (
                <div
                  className="absolute z-50 left-1/2 top-full mt-2 w-[220px] -translate-x-1/2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-semibold text-gray-800 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  role="status"
                  aria-live="polite"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div>
                    {kpiChangeText(
                      managementInsights?.deltas?.positive?.abs,
                      managementInsights?.deltas?.positive?.pct,
                    ) || 'No comparison available'}
                  </div>
                  {getRelatedAlerts('positive').map((a) => (
                    <div
                      key={a.id}
                      className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-900"
                    >
                      <span className="font-semibold">{a.title}</span>
                      {a.message ? <span className="font-medium text-emerald-800"> · {a.message}</span> : null}
                    </div>
                  ))}
                </div>
              )}
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
              {activeKpiChange === 'neutral' && (
                <div
                  className="absolute z-50 left-1/2 top-full mt-2 w-[220px] -translate-x-1/2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-semibold text-gray-800 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  role="status"
                  aria-live="polite"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div>
                    {kpiChangeText(
                      managementInsights?.deltas?.neutral?.abs,
                      managementInsights?.deltas?.neutral?.pct,
                    ) || 'No comparison available'}
                  </div>
                </div>
              )}
            </div>
          </button>

          <button
            type="button"
            className="metric-card metric-card--kpi metric-card--tint-priority w-full cursor-pointer text-left"
            style={{ '--kpi-pct': `${kpiTrackPercent.highPriority}%` }}
            aria-label="View high priority feedback in inbox"
            onPointerEnter={onKpiPointerEnter('highPriority')}
            onPointerLeave={onKpiPointerLeave()}
            onFocus={() => setActiveKpiChange('highPriority')}
            onBlur={() => setActiveKpiChange(null)}
            onClick={(e) => {
              e.stopPropagation()
              if (activeKpiChange !== 'highPriority') {
                setActiveKpiChange('highPriority')
                return
              }
              setActiveKpiChange(null)
              navigateToInboxPreset({ sentiment: 'all', priority: 'high' })
            }}
          >
            <div className="relative w-full">
              <div className="metric-card__body">
                <div className="metric-card__icon" aria-hidden>
                  <FiAlertTriangle className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <div className="metric-card__text">
                  <p className="metric-card__value">{metrics.highPriority}</p>
                  <p className="metric-card__label">High Priority</p>
                </div>
              </div>
              <div className="metric-card__footer">
                <div className="metric-card__track" aria-hidden>
                  <div className="metric-card__track-fill" />
                </div>
              </div>
              {activeKpiChange === 'highPriority' && (
                <div
                  className="absolute z-50 left-1/2 top-full mt-2 w-[220px] -translate-x-1/2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-semibold text-gray-800 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  role="status"
                  aria-live="polite"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div>High-priority comparison is not enabled yet.</div>
                </div>
              )}
            </div>
          </button>
        </>
      )}
    </div>
  )
}
