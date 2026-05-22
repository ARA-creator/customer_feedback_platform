import { formatInsuranceTagChartLabel } from './dashboardFormatters'

function clamp(n, min, max) {
  const x = Number(n)
  if (!Number.isFinite(x)) return min
  return Math.min(max, Math.max(min, x))
}

export function fmtPct(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0%'
  return `${Math.round(v * 100)}%`
}

export function humanizeSource(key) {
  const s = String(key || '').trim()
  if (!s) return 'Unknown'
  if (s === 'google_forms') return 'Google Forms'
  if (s === 'whatsapp') return 'WhatsApp'
  if (s === 'email') return 'Email'
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function computeThemeRisk(theme) {
  const total = Number(theme?.total ?? 0) || 0
  if (total <= 0) return 0
  return (Number(theme?.negative ?? 0) || 0) / total
}

export function computeSentimentIndex(pos, neg, total) {
  const t = Number(total ?? 0) || 0
  if (t <= 0) return 0
  const p = Number(pos ?? 0) || 0
  const n = Number(neg ?? 0) || 0
  return clamp((p - n) / t, -1, 1)
}

export function buildTopThemes(insuranceTagsBreakdown, limit = 8) {
  return Object.entries(insuranceTagsBreakdown || {})
    .map(([k, v]) => ({
      key: k,
      label: formatInsuranceTagChartLabel(k),
      total: Number(v?.total ?? 0) || 0,
      positive: Number(v?.positive ?? 0) || 0,
      negative: Number(v?.negative ?? 0) || 0,
      neutral: Number(v?.neutral ?? 0) || 0,
    }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

export function buildInsightBrief({ topThemes, sourcePerformance, metrics, rangeDays }) {
  const totalFeedback = Number(metrics?.totalFeedback ?? 0) || 0
  const themes = Array.isArray(topThemes) ? topThemes : []
  const sources = Array.isArray(sourcePerformance) ? sourcePerformance : []

  const topByVolume = themes[0]
  const topByRisk = [...themes].sort((a, b) => computeThemeRisk(b) - computeThemeRisk(a))[0]
  const lowestSource = [...sources]
    .filter((s) => (Number(s?.total ?? 0) || 0) > 0)
    .sort((a, b) => {
      const av = Number(a?.avg_score)
      const bv = Number(b?.avg_score)
      const aVal = Number.isFinite(av) ? av : 0
      const bVal = Number.isFinite(bv) ? bv : 0
      return aVal - bVal
    })[0]

  const parts = []
  if (topByVolume && totalFeedback > 0) {
    const share = topByVolume.total / totalFeedback
    const negPct = Math.round(computeThemeRisk(topByVolume) * 100)
    parts.push(
      `${topByVolume.label} accounts for ${fmtPct(share)} of volume${negPct > 0 ? ` — ${negPct}% negative` : ''}.`,
    )
  }
  if (lowestSource) {
    const avg = Number(lowestSource.avg_score)
    const avgLabel = Number.isFinite(avg) ? avg.toFixed(2) : '—'
    parts.push(
      `${humanizeSource(lowestSource.source)} has the lowest average sentiment (${avgLabel}) in the last ${rangeDays} days.`,
    )
  }

  const headline =
    parts.length > 0
      ? parts.join(' ')
      : `No themed feedback in the last ${rangeDays} days. Adjust the product filter or date range.`

  return {
    headline,
    topRiskTheme: topByRisk?.key ? topByRisk : null,
    lowestSource: lowestSource || null,
  }
}

export function buildSourceSparkline(sourceTrends, sourceKey, maxPoints = 14) {
  const data = Array.isArray(sourceTrends?.data) ? sourceTrends.data : []
  const key = String(sourceKey || '')
  if (!key || !data.length) return []
  return data
    .slice(-maxPoints)
    .map((row) => ({
      date: row?.date,
      value: Number(row?.[key] ?? 0) || 0,
    }))
}

export function buildThemeSparkline(insuranceTagsTrends, themeKey, maxPoints = 14) {
  const rows = Array.isArray(insuranceTagsTrends) ? insuranceTagsTrends : []
  const key = String(themeKey || '')
  if (!key || !rows.length) return []
  return rows.slice(-maxPoints).map((row) => ({
    date: row?.date,
    value: Number(row?.[key] ?? 0) || 0,
  }))
}

export function computePainShare(source, allNegative) {
  const neg = Number(source?.negative ?? 0) || 0
  const all = Number(allNegative ?? 0) || 0
  if (all <= 0) return 0
  return neg / all
}

export function sentimentGradientStyle(pos, neu, neg, total) {
  const t = Number(total ?? 0) || 0
  if (t <= 0) return { background: 'rgb(229 231 235)' }
  const pPct = (Number(pos ?? 0) / t) * 100
  const nPct = (Number(neu ?? 0) / t) * 100
  const negPct = (Number(neg ?? 0) / t) * 100
  return {
    background: `linear-gradient(90deg, rgb(16 185 129 / 0.75) 0%, rgb(16 185 129 / 0.75) ${pPct}%, rgb(156 163 175 / 0.5) ${pPct}%, rgb(156 163 175 / 0.5) ${pPct + nPct}%, rgb(244 63 94 / 0.75) ${pPct + nPct}%, rgb(244 63 94 / 0.75) 100%)`,
    opacity: Math.max(0.35, Math.min(1, 0.35 + (t / 30) * 0.65)),
  }
}

export function gaugeColorFromScore(avgScore) {
  const v = Number(avgScore)
  if (!Number.isFinite(v)) return 'rgb(156 163 175)'
  if (v <= -0.3) return 'rgb(244 63 94)'
  if (v <= 0.1) return 'rgb(245 158 11)'
  return 'rgb(16 185 129)'
}
