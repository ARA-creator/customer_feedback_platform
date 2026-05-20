export function clampPercent(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.min(100, Math.max(0, x))
}

export function getOverviewTimeFilterLabel(overviewTimeFilter) {
  switch (overviewTimeFilter) {
    case 'today':
      return 'Today'
    case 'week':
      return 'This week'
    case 'last_week':
      return 'Last week'
    case 'month':
      return 'This month'
    case 'all':
    default:
      return 'All time'
  }
}

export function getOverviewTrendLabels(overviewTimeFilter) {
  switch (overviewTimeFilter) {
    case 'today':
      return {
        title: 'Sentiment Trend (Today)',
        empty:
          'No feedback for today. The chart shows daily counts at zero for this period.',
      }
    case 'week':
      return {
        title: 'Sentiment Trend (This week)',
        empty:
          'No feedback for this week. The chart shows daily counts at zero for this period.',
      }
    case 'last_week':
      return {
        title: 'Sentiment Trend (Last week)',
        empty:
          'No feedback for last week. The chart shows daily counts at zero for this period.',
      }
    case 'month':
      return {
        title: 'Sentiment Trend (This month)',
        empty:
          'No feedback for this month. The chart shows daily counts at zero for this period.',
      }
    case 'all':
    default:
      return {
        title: 'Sentiment Trend (Last 30 days)',
        empty:
          'No feedback in the last 30 days. The chart shows daily counts at zero for this period.',
      }
  }
}

/** Short period label for chart subtitles (product breakdown, word cloud, source). */
export function getOverviewPeriodContext(overviewTimeFilter) {
  const label = getOverviewTimeFilterLabel(overviewTimeFilter)
  return {
    label,
    productSubtitle: `Volume by product · ${label}`,
    wordCloudSubtitle: `Top terms from feedback · ${label}`,
    sourceSubtitle: `Channel volume and sentiment · ${label}`,
  }
}

export function getOverviewThemesCaption(overviewTimeFilter) {
  switch (overviewTimeFilter) {
    case 'today':
      return {
        subtitle: 'Counts from today',
        empty: 'No themes for the selected period.',
      }
    case 'week':
      return {
        subtitle: 'Counts from the last 7 days',
        empty: 'No themes for the selected period.',
      }
    case 'last_week':
      return {
        subtitle: 'Counts from the previous calendar week',
        empty: 'No themes for the selected period.',
      }
    case 'month':
      return {
        subtitle: 'Counts this calendar month',
        empty: 'No themes for the selected period.',
      }
    case 'all':
    default:
      return {
        subtitle: 'Counts from the last 30 days (rolling window)',
        empty: 'No themes for the selected period.',
      }
  }
}

export function computeKpiTrackPercent(metrics) {
  const d = Math.max(Number(metrics?.totalFeedback) || 0, 1)
  return {
    total: 100,
    negative: clampPercent(((Number(metrics?.negative) || 0) / d) * 100),
    positive: clampPercent(((Number(metrics?.positive) || 0) / d) * 100),
    neutral: clampPercent(((Number(metrics?.neutral) || 0) / d) * 100),
    highPriority: clampPercent(((Number(metrics?.highPriority) || 0) / d) * 100),
  }
}

export function computeTrendYStats(trendData) {
  const rows = Array.isArray(trendData) ? trendData : []
  const max = rows.reduce((m, t) => {
    const p = Number(t?.positive) || 0
    const n = Number(t?.neutral) || 0
    const g = Number(t?.negative) || 0
    return Math.max(m, p, n, g)
  }, 0)
  return {
    trendYMax: max === 0 ? 1 : Math.ceil(max * 1.15),
    trendAllZero: rows.length > 0 && max === 0,
  }
}

