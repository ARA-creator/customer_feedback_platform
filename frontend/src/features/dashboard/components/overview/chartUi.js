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

/** Mockup-style channel colors (falls back to chart palette). */
export function channelFillColor(source, index = 0) {
  const key = String(source || '')
    .trim()
    .toLowerCase()
  const map = {
    web_form: '#5ec962',
    jotform: '#FF6100',
    google_forms: '#5ec962',
    email: '#2F855A',
    mobile_app: '#E6C76B',
    app: '#E6C76B',
    chat: '#4A90D9',
    live_chat: '#4A90D9',
    whatsapp: '#21918c',
    instagram: '#C13584',
    facebook: '#4267B2',
    x: '#1DA1F2',
    twitter: '#1DA1F2',
    other: '#d1d5db',
  }
  return map[key] || CHART_PALETTE[index % CHART_PALETTE.length]
}

export const TREND_PERCENT_Y_DOMAIN = [0, 100]
export const TREND_PERCENT_Y_TICKS = [0, 25, 50, 75, 100]

export const TREND_GRANULARITY_OPTIONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
]

function weekStartKey(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** Sum daily buckets into weekly or monthly series (counts). */
export function aggregateTrendSeries(rows, granularity = 'daily') {
  const list = Array.isArray(rows) ? rows : []
  if (granularity === 'daily' || list.length === 0) return list

  const map = new Map()
  for (const row of list) {
    const date = row?.date
    if (!date) continue
    const key =
      granularity === 'monthly'
        ? `${String(date).slice(0, 7)}-01`
        : weekStartKey(date)
    const cur = map.get(key) || { date: key, positive: 0, negative: 0, neutral: 0, total: 0 }
    cur.positive += Number(row.positive) || 0
    cur.negative += Number(row.negative) || 0
    cur.neutral += Number(row.neutral) || 0
    cur.total += Number(row.total) || 0
    map.set(key, cur)
  }
  return [...map.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

/** Per-day (or bucket) sentiment share 0–100 for mockup-style trend lines. */
export function toTrendPercentSeries(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const p = Number(row.positive) || 0
    const n = Number(row.negative) || 0
    const u = Number(row.neutral) || 0
    const t = p + n + u
    if (t <= 0) {
      return { ...row, positive: 0, negative: 0, neutral: 0 }
    }
    return {
      ...row,
      positive: Math.round((p / t) * 100),
      negative: Math.round((n / t) * 100),
      neutral: Math.round((u / t) * 100),
    }
  })
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
    fill: channelFillColor(r.source, i),
    pct: total > 0 ? Math.round((r.value / total) * 100) : 0,
  }))
}

/** Top products by primary policy match volume (overview Product Breakdown card). */
export function buildProductBreakdownRows(productPulse, { limit = 5, filterKey = 'all' } = {}) {
  const list = (Array.isArray(productPulse) ? productPulse : []).filter((r) => (Number(r?.total) || 0) > 0)
  const allTotal = list.reduce((s, r) => s + (Number(r.total) || 0), 0)

  let filtered = list
  if (filterKey && filterKey !== 'all') {
    filtered = list.filter((r) => r.key === filterKey)
  }

  const sorted = [...filtered].sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0)).slice(0, limit)
  const max = sorted.reduce((m, r) => Math.max(m, Number(r.total) || 0), 0) || 1

  return sorted.map((r) => {
    const total = Number(r.total) || 0
    const positive = Number(r.positive) || 0
    const neutral = Number(r.neutral) || 0
    const negative = Number(r.negative) || 0
    return {
      key: r.key,
      name: r.name,
      product_prefix: r.product_prefix,
      product_group: r.product_group,
      total,
      positive,
      neutral,
      negative,
      positivePct: total > 0 ? Math.round((positive / total) * 100) : 0,
      neutralPct: total > 0 ? Math.round((neutral / total) * 100) : 0,
      negativePct: total > 0 ? Math.round((negative / total) * 100) : 0,
      sharePct: allTotal > 0 ? Math.round((total / allTotal) * 100) : 0,
      barPct: max > 0 ? Math.round((total / max) * 100) : 0,
    }
  })
}

export function buildProductFilterOptions(productPulse) {
  const list = Array.isArray(productPulse) ? productPulse : []
  return [
    { id: 'all', label: 'All products' },
    ...list
      .filter((r) => r.key && r.key !== '|')
      .map((r) => ({ id: r.key, label: r.name })),
  ]
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

function formatGaugeDateLabel(value) {
  if (value == null) return ''
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) {
      const parts = String(value).split('-')
      if (parts.length >= 3) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return `${months[Number(parts[1]) - 1] || 'Jan'} ${Number(parts[2])}`
      }
      return String(value)
    }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[d.getMonth()]} ${d.getDate()}`
  } catch {
    return String(value)
  }
}

/** Date range under gauge, e.g. "Apr 11 – May 11". */
export function getSentimentGaugePeriodLabel(trendData) {
  const rows = Array.isArray(trendData) ? trendData.filter((d) => d?.date) : []
  if (rows.length === 0) return null
  if (rows.length === 1) return formatGaugeDateLabel(rows[0].date)
  return `${formatGaugeDateLabel(rows[0].date)} – ${formatGaugeDateLabel(rows[rows.length - 1].date)}`
}

function _sentimentShareInChunk(chunk, field) {
  let part = 0
  let total = 0
  for (const d of chunk) {
    part += Number(d[field]) || 0
    total += (Number(d.positive) || 0) + (Number(d.negative) || 0) + (Number(d.neutral) || 0)
  }
  return total > 0 ? (part / total) * 100 : 0
}

/** Share delta for a sentiment: second half of period vs first half (percentage points). */
export function computeSentimentShareDelta(trendData, sentimentKey = 'positive') {
  const key = String(sentimentKey || 'positive').toLowerCase()
  const field = key === 'negative' || key === 'neutral' ? key : 'positive'
  const rows = Array.isArray(trendData) ? trendData : []
  if (rows.length < 4) return null
  const mid = Math.floor(rows.length / 2)
  const later = _sentimentShareInChunk(rows.slice(mid), field)
  const earlier = _sentimentShareInChunk(rows.slice(0, mid), field)
  return Math.round(later - earlier)
}

/** @deprecated Use computeSentimentShareDelta(trendData, 'positive') */
export function computePositiveShareDelta(trendData) {
  return computeSentimentShareDelta(trendData, 'positive')
}
