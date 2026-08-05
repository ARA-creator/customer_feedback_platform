import { FiBarChart2, FiMinus, FiThumbsDown, FiThumbsUp } from 'react-icons/fi'

const ALL_CARD_IDS = ['total', 'negative', 'positive', 'neutral']

const CARD_CONFIG = {
  total: {
    tintClass: 'metric-card--tint-total',
    ariaLabel: 'View all feedback in inbox',
    inboxSentiment: 'all',
    Icon: FiBarChart2,
    valueKey: 'totalFeedback',
    label: 'Total Feedback',
    kpiKey: 'total',
  },
  negative: {
    tintClass: 'metric-card--tint-negative',
    ariaLabel: 'View negative feedback in inbox',
    inboxSentiment: 'negative',
    Icon: FiThumbsDown,
    valueKey: 'negative',
    label: 'Negative',
    kpiKey: 'negative',
  },
  positive: {
    tintClass: 'metric-card--tint-positive',
    ariaLabel: 'View positive feedback in inbox',
    inboxSentiment: 'positive',
    Icon: FiThumbsUp,
    valueKey: 'positive',
    label: 'Positive',
    kpiKey: 'positive',
  },
  neutral: {
    tintClass: 'metric-card--tint-neutral',
    ariaLabel: 'View neutral feedback in inbox',
    inboxSentiment: 'neutral',
    Icon: FiMinus,
    valueKey: 'neutral',
    label: 'Neutral',
    kpiKey: 'neutral',
  },
}

function visibleCardIds(sentimentFilter) {
  if (!sentimentFilter || sentimentFilter === 'all') return ALL_CARD_IDS
  if (ALL_CARD_IDS.includes(sentimentFilter)) return [sentimentFilter]
  return ALL_CARD_IDS
}

function gridClassForCount(count) {
  if (count <= 1) return 'grid-cols-1 w-full max-w-md mx-auto'
  if (count === 2) return 'grid-cols-2 max-w-2xl mx-auto'
  if (count === 3) return 'grid-cols-2 md:grid-cols-3 max-w-4xl mx-auto'
  return 'grid-cols-2 md:grid-cols-2 xl:grid-cols-4 w-full'
}

function formatShare(value) {
  const share = Number(value) || 0
  return `${share.toFixed(share % 1 === 0 ? 0 : 1)}% share`
}

/**
 * Overview KPI strip (total, sentiment breakdown). Click a card to open the inbox with that filter.
 * When a sentiment pill is active, only that sentiment's card is shown (all four when "All sentiments").
 */
export default function OverviewMetricCards({
  metrics,
  kpiTrackPercent,
  analyticsLoading,
  analyticsDelayPassed,
  navigateToInboxPreset,
  sentimentFilter = 'all',
}) {
  const loading = analyticsLoading || !analyticsDelayPassed
  const cardIds = visibleCardIds(sentimentFilter)
  const gridClass = gridClassForCount(cardIds.length)

  return (
    <div className={`grid gap-3 sm:gap-4 xl:gap-6 ${gridClass}`}>
      {loading ? (
        cardIds.map((id) => {
          const { tintClass } = CARD_CONFIG[id]
          return (
            <div key={id} className={`metric-card metric-card--kpi ${tintClass} animate-pulse`}>
              <div className="metric-card__body">
                <div className="h-10 w-10 rounded-full bg-black/[0.06] dark:bg-white/[0.12]" />
                <div className="metric-card__text">
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
          )
        })
      ) : (
        cardIds.map((id) => {
          const { tintClass, ariaLabel, inboxSentiment, Icon, valueKey, label, kpiKey } = CARD_CONFIG[id]
          const share = kpiTrackPercent[kpiKey]
          return (
            <button
              key={id}
              type="button"
              className={`metric-card metric-card--kpi ${tintClass} w-full cursor-pointer`}
              style={{ '--kpi-pct': `${share}%` }}
              aria-label={`${ariaLabel} (${formatShare(share)})`}
              onClick={() => navigateToInboxPreset({ sentiment: inboxSentiment, priority: 'all' })}
            >
              <div className="metric-card__body">
                <div className="metric-card__icon" aria-hidden>
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <div className="metric-card__text">
                  <p className="metric-card__value">{metrics[valueKey]}</p>
                  <p className="metric-card__label">{label}</p>
                  <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-gray-500/90 dark:text-gray-400">
                    {formatShare(share)}
                  </p>
                </div>
              </div>
              <div className="metric-card__footer">
                <div className="metric-card__track" aria-hidden>
                  <div className="metric-card__track-fill" />
                </div>
              </div>
            </button>
          )
        })
      )}
    </div>
  )
}
