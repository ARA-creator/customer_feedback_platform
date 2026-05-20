export function clampPercent(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.min(100, Math.max(0, x))
}

const OVERVIEW_PERIOD_CONFIG = {
  today: {
    id: 'today',
    label: 'Today',
    metricsHint: 'Counts for today',
    themes: {
      subtitle: 'Counts from today',
      empty: 'No themes for today.',
    },
    trend: {
      title: 'Sentiment Trend (Today)',
      empty: 'No feedback for today. The chart shows daily counts at zero for this period.',
      exportHeader: 'Trends (today)',
    },
    productPulse: {
      subtitle: 'Volume by product · today',
      empty: 'No product/policy matches for today.',
    },
    sourceChart: {
      subtitle: 'Channel volume and sentiment · today',
    },
    wordCloud: {
      subtitle: 'All stored feedback (not limited to the period filter)',
    },
    exportFilenameSuffix: 'today',
  },
  week: {
    id: 'week',
    label: 'This week',
    metricsHint: 'Counts for the last 7 days',
    themes: {
      subtitle: 'Counts from the last 7 days',
      empty: 'No themes for this week.',
    },
    trend: {
      title: 'Sentiment Trend (This week)',
      empty: 'No feedback for this week. The chart shows daily counts at zero for this period.',
      exportHeader: 'Trends (this week)',
    },
    productPulse: {
      subtitle: 'Volume by product · last 7 days',
      empty: 'No product/policy matches for this week.',
    },
    sourceChart: {
      subtitle: 'Channel volume and sentiment · last 7 days',
    },
    wordCloud: {
      subtitle: 'All stored feedback (not limited to the period filter)',
    },
    exportFilenameSuffix: 'last_7_days',
  },
  last_week: {
    id: 'last_week',
    label: 'Last week',
    metricsHint: 'Counts for the previous calendar week',
    themes: {
      subtitle: 'Counts from the previous calendar week',
      empty: 'No themes for last week.',
    },
    trend: {
      title: 'Sentiment Trend (Last week)',
      empty: 'No feedback for last week. The chart shows daily counts at zero for this period.',
      exportHeader: 'Trends (last week)',
    },
    productPulse: {
      subtitle: 'Volume by product · previous calendar week',
      empty: 'No product/policy matches for last week.',
    },
    sourceChart: {
      subtitle: 'Channel volume and sentiment · last week',
    },
    wordCloud: {
      subtitle: 'All stored feedback (not limited to the period filter)',
    },
    exportFilenameSuffix: 'last_week',
  },
  month: {
    id: 'month',
    label: 'This month',
    metricsHint: 'Counts for this calendar month',
    themes: {
      subtitle: 'Counts from this calendar month',
      empty: 'No themes for this month.',
    },
    trend: {
      title: 'Sentiment Trend (This month)',
      empty: 'No feedback for this month. The chart shows daily counts at zero for this period.',
      exportHeader: 'Trends (this month)',
    },
    productPulse: {
      subtitle: 'Volume by product · this month',
      empty: 'No product/policy matches for this month.',
    },
    sourceChart: {
      subtitle: 'Channel volume and sentiment · this month',
    },
    wordCloud: {
      subtitle: 'All stored feedback (not limited to the period filter)',
    },
    exportFilenameSuffix: 'this_month',
  },
  all: {
    id: 'all',
    label: 'All time',
    metricsHint: 'Counts for the last 30 days (overview default)',
    themes: {
      subtitle: 'Counts from the last 30 days',
      empty: 'No themes for the last 30 days.',
    },
    trend: {
      title: 'Sentiment Trend (Last 30 days)',
      empty: 'No feedback in the last 30 days. The chart shows daily counts at zero for this period.',
      exportHeader: 'Trends (last 30 days)',
    },
    productPulse: {
      subtitle: 'Volume by product · last 30 days',
      empty: 'No product/policy matches for the last 30 days.',
    },
    sourceChart: {
      subtitle: 'Channel volume and sentiment · last 30 days',
    },
    wordCloud: {
      subtitle: 'All stored feedback (not limited to the period filter)',
    },
    exportFilenameSuffix: 'last_30_days',
  },
}

/** Single source of truth for overview time-filter labels and copy. */
export function getOverviewPeriodConfig(timeWindow) {
  const id = timeWindow && OVERVIEW_PERIOD_CONFIG[timeWindow] ? timeWindow : 'all'
  return OVERVIEW_PERIOD_CONFIG[id]
}

export function getOverviewTimeFilterLabel(timeWindow) {
  return getOverviewPeriodConfig(timeWindow).label
}

export function getOverviewTrendLabels(timeWindow) {
  const c = getOverviewPeriodConfig(timeWindow)
  return { title: c.trend.title, empty: c.trend.empty }
}

export function getOverviewThemesCaption(timeWindow) {
  const c = getOverviewPeriodConfig(timeWindow)
  return { subtitle: c.themes.subtitle, empty: c.themes.empty }
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
