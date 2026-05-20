import { FiBarChart2, FiMinus, FiThumbsDown, FiThumbsUp } from 'react-icons/fi'

/**
 * Overview KPI strip (total, sentiment breakdown). Click a card to open the inbox with that filter.
 */
export default function OverviewMetricCards({
  metrics,
  kpiTrackPercent,
  analyticsLoading,
  analyticsDelayPassed,
  navigateToInboxPreset,
}) {
  const loading = analyticsLoading || !analyticsDelayPassed

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
            onClick={() => navigateToInboxPreset({ sentiment: 'all', priority: 'all' })}
          >
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
          </button>

          <button
            type="button"
            className="metric-card metric-card--kpi metric-card--tint-negative w-full cursor-pointer text-left"
            style={{ '--kpi-pct': `${kpiTrackPercent.negative}%` }}
            aria-label="View negative feedback in inbox"
            onClick={() => navigateToInboxPreset({ sentiment: 'negative', priority: 'all' })}
          >
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
          </button>

          <button
            type="button"
            className="metric-card metric-card--kpi metric-card--tint-positive w-full cursor-pointer text-left"
            style={{ '--kpi-pct': `${kpiTrackPercent.positive}%` }}
            aria-label="View positive feedback in inbox"
            onClick={() => navigateToInboxPreset({ sentiment: 'positive', priority: 'all' })}
          >
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
          </button>

          <button
            type="button"
            className="metric-card metric-card--kpi metric-card--tint-neutral w-full cursor-pointer text-left"
            style={{ '--kpi-pct': `${kpiTrackPercent.neutral}%` }}
            aria-label="View neutral feedback in inbox"
            onClick={() => navigateToInboxPreset({ sentiment: 'neutral', priority: 'all' })}
          >
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
          </button>
        </>
      )}
    </div>
  )
}
