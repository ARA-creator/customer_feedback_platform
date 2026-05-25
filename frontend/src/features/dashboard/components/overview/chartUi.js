import { CHART_PALETTE, SENTIMENT_COLORS } from '../../constants/palette'
import { humanizeSource } from '../../utils/insightsMetrics'
import { formatInsuranceTagChartLabel } from '../../utils/dashboardFormatters'

export const CHART_TICK = { fill: '#6b7280', fontSize: 11 }
export const CHART_GRID = { stroke: '#e5e7eb', strokeDasharray: '3 3' }
export const CHART_TOOLTIP = {
  contentStyle: {
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    fontSize: '12px',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
  },
}

export function formatTrendAxisDate(value) {
  if (value == null || typeof value !== 'string') return value
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) {
      const parts = value.split('-')
      if (parts.length >= 3) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return `${months[Number(parts[1]) - 1] || ''} ${Number(parts[2])}`
      }
      return value
    }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[d.getMonth()]} ${d.getDate()}`
  } catch {
    return value
  }
}

export function buildChannelDonutData(sourcePerformance) {
  const rows = Array.isArray(sourcePerformance) ? sourcePerformance : []
  const sorted = [...rows]
    .map((r) => ({
      name: humanizeSource(r.source),
      value: Number(r.total) || 0,
      source: r.source,
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)

  const total = sorted.reduce((s, r) => s + r.value, 0)
  return sorted.map((r, i) => ({
    ...r,
    fill: CHART_PALETTE[i % CHART_PALETTE.length],
    pct: total > 0 ? Math.round((r.value / total) * 100) : 0,
  }))
}

export function buildTopicsTableRows(insuranceTagsBreakdown, { limit = 6 } = {}) {
  const b = insuranceTagsBreakdown && typeof insuranceTagsBreakdown === 'object' ? insuranceTagsBreakdown : {}
  return Object.entries(b)
    .map(([key, stats]) => {
      const total = Number(stats?.total) || 0
      const pos = Number(stats?.positive) || 0
      const neg = Number(stats?.negative) || 0
      const posPct = total > 0 ? (pos / total) * 100 : 0
      const negPct = total > 0 ? (neg / total) * 100 : 0
      return {
        key,
        name: formatInsuranceTagChartLabel(key),
        total,
        posPct,
        negPct,
        neutralPct: Math.max(0, 100 - posPct - negPct),
      }
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

export function sentimentTotals(sentimentData) {
  const rows = Array.isArray(sentimentData) ? sentimentData : []
  const get = (name) => Number(rows.find((r) => r.name === name)?.value) || 0
  const positive = get('Positive')
  const negative = get('Negative')
  const neutral = get('Neutral')
  const total = positive + negative + neutral
  return {
    positive,
    negative,
    neutral,
    total,
    positivePct: total > 0 ? Math.round((positive / total) * 100) : 0,
    negativePct: total > 0 ? Math.round((negative / total) * 100) : 0,
    neutralPct: total > 0 ? Math.round((neutral / total) * 100) : 0,
  }
}

export function sentimentLegendItems() {
  return [
    { label: 'Positive', color: SENTIMENT_COLORS.Positive },
    { label: 'Negative', color: SENTIMENT_COLORS.Negative },
    { label: 'Neutral', color: SENTIMENT_COLORS.Neutral },
  ]
}
