import { FiArrowLeft } from 'react-icons/fi'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import { CHART_PALETTE } from '../constants/palette'
import { getPeakHeatmapCellStyles } from '../utils/dashboardRole'
import { formatInsuranceTagChartLabel } from '../utils/dashboardFormatters'

function clamp(n, min, max) {
  const x = Number(n)
  if (!Number.isFinite(x)) return min
  return Math.min(max, Math.max(min, x))
}

function fmtPct(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0%'
  return `${Math.round(v * 100)}%`
}

function fmtDayLabel(iso) {
  if (!iso) return ''
  const s = String(iso)
  const parts = s.split('-')
  if (parts.length >= 3) return `${parts[1]}/${parts[2]}`
  return s
}

function humanizeSource(key) {
  const s = String(key || '').trim()
  if (!s) return 'Unknown'
  if (s === 'google_forms') return 'Google Forms'
  if (s === 'whatsapp') return 'WhatsApp'
  if (s === 'email') return 'Email'
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function StatCard({ label, value, sub, accent = 'emerald' }) {
  const accentMap = {
    emerald: 'border-emerald-200/60 bg-emerald-50/60 text-emerald-950 dark:border-emerald-400/15 dark:bg-emerald-400/10 dark:text-emerald-100',
    teal: 'border-teal-200/60 bg-teal-50/60 text-teal-950 dark:border-teal-400/15 dark:bg-teal-400/10 dark:text-teal-100',
    amber: 'border-amber-200/60 bg-amber-50/60 text-amber-950 dark:border-amber-400/15 dark:bg-amber-400/10 dark:text-amber-100',
    rose: 'border-rose-200/60 bg-rose-50/60 text-rose-950 dark:border-rose-400/15 dark:bg-rose-400/10 dark:text-rose-100',
    slate: 'border-gray-200/70 bg-white/60 text-gray-900 dark:border-white/10 dark:bg-gray-950/25 dark:text-gray-100',
  }
  const shell = accentMap[accent] || accentMap.slate
  return (
    <div className={`rounded-2xl border p-4 shadow-sm transition-transform duration-200 hover:-translate-y-[1px] ${shell}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {sub ? <p className="mt-1 text-xs opacity-80">{sub}</p> : null}
    </div>
  )
}

function SectionCard({ title, subtitle, right, children }) {
  return (
    <div className="card p-4 sm:p-6 bg-white/90 dark:bg-gray-950/75">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 max-w-prose">
              {subtitle}
            </p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

export default function DashboardInsightsSection({
  onNavigateBack,
  onNavigateToInbox,
  insightsProductKey,
  setInsightsProductKey,
  insightsProductOptions,
  insightsRange,
  setInsightsRange,
  analyticsLoading,
  analyticsDelayPassed,
  isDarkMode,
  trendData,
  metrics,
  productPulseTrendPivot,
  insuranceTagsBreakdown,
  categoryData,
  sourceTrends,
  sourceTrendColors,
  sourcePerformance,
  peakTimes,
  peakTimesTotalCount,
  peakTimesMaxCount,
  heatmapHover,
  setHeatmapHover,
}) {
  const rangeLabel = `Last ${insightsRange} days`
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const safeTrends = Array.isArray(trendData) ? trendData : []

  const sentimentSeries = safeTrends.map((r) => ({
    date: r?.date,
    total: Number(r?.total ?? 0) || 0,
    positive: Number(r?.positive ?? 0) || 0,
    neutral: Number(r?.neutral ?? 0) || 0,
    negative: Number(r?.negative ?? 0) || 0,
    // A simple exec-friendly index: net positivity scaled to 0..100
    sentiment_index: (() => {
      const t = Number(r?.total ?? 0) || 0
      if (t <= 0) return 50
      const net = (Number(r?.positive ?? 0) || 0) - (Number(r?.negative ?? 0) || 0)
      return clamp(50 + (net / t) * 50, 0, 100)
    })(),
  }))

  const sourceData = Array.isArray(sourceTrends?.data) ? sourceTrends.data : []
  const sources = Array.isArray(sourceTrends?.sources) ? sourceTrends.sources : []
  const sourceTotals = (() => {
    const totals = {}
    let totalAll = 0
    for (const row of sourceData) {
      for (const k of sources) {
        if (k === 'date') continue
        const n = Number(row?.[k] ?? 0) || 0
        totals[k] = (totals[k] || 0) + n
        totalAll += n
      }
    }
    return { totals, totalAll }
  })()

  const topThemes = Object.entries(insuranceTagsBreakdown || {})
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
    .slice(0, 8)

  const topIssuesFromCategories = Array.isArray(categoryData)
    ? categoryData
        .map((r) => ({ name: r?.name, value: Number(r?.value ?? 0) || 0 }))
        .filter((r) => r.value > 0)
        .slice(0, 8)
    : []

  const topIssuesChartRows =
    topIssuesFromCategories.length > 0
      ? { rows: topIssuesFromCategories, source: 'category' }
      : {
          rows: topThemes.map((t) => ({ name: t.label || t.key || 'Theme', value: t.total })).filter((r) => r.value > 0),
          source: 'themes',
        }

  const topIssuesEmpty = !topIssuesChartRows.rows.length

  // Heatmap matrix + totals
  const peakByKey = new Map()
  for (const pt of Array.isArray(peakTimes) ? peakTimes : []) {
    peakByKey.set(`${pt?.day_of_week}-${pt?.hour}`, pt)
  }
  const rowTotals = Array.from({ length: 24 }).map((_, hour) => {
    let sum = 0
    for (let dow = 0; dow < 7; dow += 1) {
      const cell = peakByKey.get(`${dow}-${hour}`)
      sum += Number(cell?.count ?? 0) || 0
    }
    return sum
  })
  const colTotals = Array.from({ length: 7 }).map((_, dow) => {
    let sum = 0
    for (let hour = 0; hour < 24; hour += 1) {
      const cell = peakByKey.get(`${dow}-${hour}`)
      sum += Number(cell?.count ?? 0) || 0
    }
    return sum
  })
  const peakHighlights = (() => {
    const all = []
    for (let hour = 0; hour < 24; hour += 1) {
      for (let dow = 0; dow < 7; dow += 1) {
        const cell = peakByKey.get(`${dow}-${hour}`)
        const count = Number(cell?.count ?? 0) || 0
        if (count > 0) all.push({ dow, hour, count })
      }
    }
    all.sort((a, b) => b.count - a.count)
    return new Set(all.slice(0, 5).map((x) => `${x.dow}-${x.hour}`))
  })()

  const loadingState = analyticsLoading || !analyticsDelayPassed

  const exportInsights = () => {
    try {
      const payload = {
        range_days: insightsRange,
        product_scope: insightsProductKey || 'all',
        generated_at: new Date().toISOString(),
        metrics,
        source_totals: sourceTotals,
        sentiment_trend: sentimentSeries,
        top_themes: topThemes,
        top_issues: topIssuesChartRows.rows,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customer-pulse-insights-${insightsRange}d.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // ignore
    }
  }

  // Source trend legend pills: shares among channels with >0 volume (avoids misleading 50/50 on zeros).
  const sourcePillKeys = (() => {
    const keys = sources.filter((k) => k && k !== 'date')
    const nonZero = keys.filter((k) => (Number(sourceTotals.totals?.[k]) || 0) > 0)
    return nonZero.length > 0 ? nonZero : keys
  })()
  const sourcePillTotal = sourcePillKeys.reduce((sum, k) => sum + (Number(sourceTotals.totals?.[k]) || 0), 0)

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="rounded-3xl border border-emerald-100/70 bg-white/90 shadow-sm dark:border-white/10 dark:bg-gray-950/75 px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => onNavigateBack?.()}
              className="inline-flex items-center justify-center h-11 w-11 rounded-2xl border border-gray-200 bg-white/90 text-gray-800 shadow-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#009750]/30 dark:border-white/10 dark:bg-gray-950/70 dark:text-gray-100 dark:hover:bg-gray-950/85"
              aria-label="Back to overview"
            >
              <FiArrowLeft className="w-5 h-5" aria-hidden />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                Insights
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Strategic analytics for leaders and analysts. <span className="font-semibold">{rangeLabel}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end">
            <select
              id="insights-product-filter"
              value={insightsProductKey}
              onChange={(e) => setInsightsProductKey(e.target.value)}
              className="min-h-[44px] max-w-[min(100vw-2rem,22rem)] rounded-2xl border border-gray-200 bg-white/90 px-3.5 py-2 text-xs font-semibold text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/25 dark:border-white/10 dark:bg-gray-950/70 dark:text-gray-100"
              aria-label="Filter insights by product name"
            >
              <option value="">All products</option>
              {insightsProductOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>

            <div
              className="inline-flex rounded-2xl border border-gray-200 bg-white/90 p-1 shadow-sm dark:border-white/10 dark:bg-gray-950/70"
              role="group"
              aria-label="Insights range"
            >
              {[7, 30, 90].map((d) => {
                const active = insightsRange === d
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setInsightsRange(d)}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#009750]/25 ${
                      active
                        ? 'bg-[#009750] text-white shadow-[0_10px_26px_rgba(16,185,129,0.18)]'
                        : 'text-gray-800 hover:bg-white dark:text-gray-200 dark:hover:bg-gray-950/55'
                    }`}
                    aria-pressed={active}
                  >
                    Last {d}d
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={exportInsights}
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-[#009750] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#007a42] focus:outline-none focus:ring-2 focus:ring-[#009750]/25"
              title="Export insights (JSON)"
            >
              Export
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Total feedback"
            value={Number(metrics?.totalFeedback ?? 0) || 0}
            sub={insightsProductKey ? 'Filtered by product' : 'All products'}
            accent="slate"
          />
          <StatCard
            label="Positive share"
            value={fmtPct((Number(metrics?.positive ?? 0) || 0) / Math.max(1, Number(metrics?.totalFeedback ?? 0) || 0))}
            sub={`${Number(metrics?.positive ?? 0) || 0} positive`}
            accent="teal"
          />
          <StatCard
            label="Negative share"
            value={fmtPct((Number(metrics?.negative ?? 0) || 0) / Math.max(1, Number(metrics?.totalFeedback ?? 0) || 0))}
            sub={`${Number(metrics?.negative ?? 0) || 0} negative`}
            accent="rose"
          />
          <StatCard
            label="High priority"
            value={Number(metrics?.highPriority ?? 0) || 0}
            sub="Requires fast triage"
            accent="amber"
          />
        </div>
      </div>

      {/* Executive overview row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Top themes"
          subtitle="Most common themes in this window. Click peak-time cells below to jump into the inbox."
        >
          {loadingState ? (
            <div className="w-full h-64 rounded-2xl bg-gray-50 dark:bg-gray-900/40 animate-pulse" />
          ) : topThemes.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">No theme data yet.</p>
          ) : (
            <div className="space-y-3">
              {topThemes.map((t, idx) => {
                const pct = t.total / Math.max(1, Number(metrics?.totalFeedback ?? 0) || 0)
                const bar = clamp(pct, 0, 1)
                return (
                  <div key={t.key} className="group">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {t.label || 'Theme'}
                      </p>
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                        {t.total} · {fmtPct(bar)}
                      </p>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-gray-100 dark:bg-gray-900/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-500/80 via-emerald-500/80 to-emerald-600/80 transition-all duration-300 group-hover:brightness-110"
                        style={{ width: `${Math.max(3, Math.round(bar * 100))}%` }}
                      />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                      <span>{t.positive} positive</span>
                      <span>·</span>
                      <span>{t.neutral} neutral</span>
                      <span>·</span>
                      <span>{t.negative} negative</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Source performance"
          subtitle="Volume and average sentiment by source."
        >
          {loadingState ? (
            <div className="w-full h-64 rounded-2xl bg-gray-50 dark:bg-gray-900/40 animate-pulse" />
          ) : !Array.isArray(sourcePerformance) || sourcePerformance.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">No source performance yet.</p>
          ) : (
            <div className="space-y-3">
              {sourcePerformance
                .slice()
                .sort((a, b) => (Number(b?.total ?? 0) || 0) - (Number(a?.total ?? 0) || 0))
                .slice(0, 6)
                .map((s) => {
                  const total = Number(s?.total ?? 0) || 0
                  const avg = s?.avg_score
                  const avgVal = Number(avg)
                  const avgLabel = Number.isFinite(avgVal) ? avgVal.toFixed(2) : '—'
                  const share = total / Math.max(1, Number(metrics?.totalFeedback ?? 0) || 0)
                  return (
                    <div
                      key={s.source}
                      className="rounded-2xl border border-gray-200/70 bg-white/90 px-4 py-3 shadow-sm transition-transform duration-200 hover:-translate-y-[1px] dark:border-white/10 dark:bg-gray-950/70"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {humanizeSource(s.source)}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                            {total} feedback · {fmtPct(share)} of total
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Avg sentiment</p>
                          <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">{avgLabel}</p>
                        </div>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-gray-100 dark:bg-gray-900/60 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500/70 to-teal-500/70"
                          style={{ width: `${Math.max(3, Math.round(clamp(share, 0, 1) * 100))}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Source trend"
          subtitle="Daily volume by top channels (others grouped). Pills show share among channels with volume in this range."
          right={
            <div className="flex flex-wrap gap-2">
              {sourcePillKeys.slice(0, 6).map((k, idx) => {
                const total = Number(sourceTotals.totals?.[k] ?? 0) || 0
                const share = total / Math.max(1, sourcePillTotal || 0)
                const color = sourceTrendColors?.[k] || CHART_PALETTE[idx % CHART_PALETTE.length]
                return (
                  <div
                    key={`src-pill-${k}`}
                    className="rounded-full border border-gray-200 bg-white/90 px-3 py-1 text-[11px] font-semibold text-gray-800 shadow-sm dark:border-white/10 dark:bg-gray-950/70 dark:text-gray-100"
                    title={`${humanizeSource(k)}: ${total} (${fmtPct(share)} of active channels)`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
                      {humanizeSource(k)} · {total ? fmtPct(share) : '0'}
                    </span>
                  </div>
                )
              })}
            </div>
          }
        >
          {loadingState ? (
            <div className="w-full h-72 rounded-2xl bg-gray-50 dark:bg-gray-900/40 animate-pulse" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sourceData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#1f2937' : '#e5e7eb'} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: isDarkMode ? '#334155' : '#e2e8f0' }}
                    tickFormatter={fmtDayLabel}
                  />
                  <YAxis
                    tick={{ fill: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: isDarkMode ? '#334155' : '#e2e8f0' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#0b1220' : '#ffffff',
                      border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                      borderRadius: 14,
                      boxShadow: '0 18px 48px rgba(2,6,23,0.12)',
                    }}
                    labelStyle={{ color: isDarkMode ? '#e5e7eb' : '#0f172a', fontWeight: 700 }}
                  />
                  <Legend formatter={(value) => humanizeSource(value)} />
                  {sources.map((src) => {
                    const key = String(src || '')
                    if (!key) return null
                    return (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        name={key}
                        stroke={sourceTrendColors?.[key] || '#64748b'}
                        strokeWidth={2.25}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Top issues"
          subtitle={
            topIssuesChartRows.source === 'themes'
              ? 'Manual categories are unset on most items; showing top insurance auto-tags in this window instead.'
              : 'Highest-volume feedback categories in this window.'
          }
        >
          {loadingState ? (
            <div className="w-full h-72 rounded-2xl bg-gray-50 dark:bg-gray-900/40 animate-pulse" />
          ) : topIssuesEmpty ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              No category or theme volume in this range yet.
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topIssuesChartRows.rows
                    .slice()
                    .sort((a, b) => b.value - a.value)
                    .map((row, idx) => ({ ...row, fill: CHART_PALETTE[idx % CHART_PALETTE.length] }))}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 40, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#1f2937' : '#e5e7eb'} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: isDarkMode ? '#334155' : '#e2e8f0' }}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: isDarkMode ? '#334155' : '#e2e8f0' }}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#0b1220' : '#ffffff',
                      border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                      borderRadius: 14,
                      boxShadow: '0 18px 48px rgba(2,6,23,0.12)',
                    }}
                    labelStyle={{ color: isDarkMode ? '#e5e7eb' : '#0f172a', fontWeight: 700 }}
                  />
                  <Bar dataKey="value" name="Count" radius={[10, 10, 10, 10]}>
                    {topIssuesChartRows.rows.map((row, idx) => (
                      <Cell key={`issue-${row.name}-${idx}`} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Peak feedback times"
          subtitle="Counts by day and hour (UTC). Color reflects sentiment balance; intensity reflects volume. Includes row/column totals and highlights top peaks."
        >
          {analyticsLoading ? (
            <div className="w-full h-72 rounded-2xl bg-gray-50 dark:bg-gray-900/40 animate-pulse" />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="inline-flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                  <span className="font-semibold shrink-0">Negative</span>
                  <span
                    className="h-2.5 w-28 rounded-full border border-gray-200 dark:border-gray-700"
                    style={{
                      background: `linear-gradient(90deg, hsl(0, 72%, ${isDarkMode ? 38 : 52}%) 0%, hsl(60, 55%, ${
                        isDarkMode ? 42 : 58
                      }%) 50%, hsl(150, 60%, ${isDarkMode ? 34 : 48}%) 100%)`,
                    }}
                  />
                  <span className="font-semibold shrink-0">Positive</span>
                </div>
                {heatmapHover?.count != null ? (
                  <div className="text-[11px] text-gray-600 dark:text-gray-300">
                    <span className="font-semibold">{days[heatmapHover?.dow] || ''}</span>
                    <span className="font-medium">
                      {' '}
                      · {String(heatmapHover?.hour).padStart(2, '0')}:00–
                      {String((heatmapHover?.hour + 1) % 24).padStart(2, '0')}:00
                    </span>
                    <span className="font-medium"> · {heatmapHover.count} total</span>
                    <span className="font-medium">
                      {' '}
                      · {heatmapHover.pos ?? 0} pos · {heatmapHover.neu ?? 0} neu · {heatmapHover.neg ?? 0} neg
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">Hover a cell to see details.</div>
                )}
              </div>

              <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white/90 shadow-sm dark:border-white/10 dark:bg-gray-950/70">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold">Hour</th>
                      {days.map((label, i) => (
                        <th key={label} className="px-2 py-2 text-center text-gray-500 dark:text-gray-400 font-semibold">
                          <span className="inline-flex items-center gap-2">
                            {label}
                            <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">
                              {colTotals[i] || 0}
                            </span>
                          </span>
                        </th>
                      ))}
                      <th className="px-2 py-2 text-center text-gray-500 dark:text-gray-400 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 24 }).map((_, hour) => (
                      <tr key={hour} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-2 py-1.5 text-gray-500 dark:text-gray-400 font-semibold">
                          {String(hour).padStart(2, '0')}:00
                        </td>
                        {Array.from({ length: 7 }).map((__, dow) => {
                          const cell = peakByKey.get(`${dow}-${hour}`)
                          const count = Number(cell?.count ?? 0) || 0
                          const pos = Number(cell?.positive ?? 0) || 0
                          const neg = Number(cell?.negative ?? 0) || 0
                          const neu = Number(cell?.neutral ?? 0) || 0
                          const hm = getPeakHeatmapCellStyles(pos, neg, count, peakTimesMaxCount, isDarkMode)
                          const canClick = count > 0
                          const isPeak = peakHighlights.has(`${dow}-${hour}`)
                          return (
                            <td
                              key={dow}
                              className={`px-2 py-1.5 text-center align-middle ${hm.classBg} ${hm.textClass} ${
                                canClick
                                  ? 'cursor-pointer hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#009750]/40'
                                  : ''
                              } ${isPeak ? 'ring-2 ring-teal-400/60 ring-inset' : ''}`}
                              style={hm.style}
                              title={`${days[dow]} ${String(hour).padStart(2, '0')}:00 · ${count} total · ${pos} pos · ${neu} neu · ${neg} neg`}
                              onMouseEnter={() => setHeatmapHover({ dow, hour, count, pos, neg, neu })}
                              onMouseLeave={() => setHeatmapHover(null)}
                              onClick={() => {
                                if (!canClick) return
                                onNavigateToInbox?.({
                                  mode: 'peak_time',
                                  dow,
                                  hour,
                                  range_days: insightsRange,
                                })
                              }}
                              role={canClick ? 'button' : undefined}
                              tabIndex={canClick ? 0 : undefined}
                              onKeyDown={(e) => {
                                if (!canClick) return
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  onNavigateToInbox?.({
                                    mode: 'peak_time',
                                    dow,
                                    hour,
                                    range_days: insightsRange,
                                  })
                                }
                              }}
                            >
                              {count || ''}
                            </td>
                          )
                        })}
                        <td className="px-2 py-1.5 text-center font-semibold text-gray-600 dark:text-gray-300">
                          {rowTotals[hour] || ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 dark:border-gray-800 bg-white/40 dark:bg-gray-950/25">
                      <td className="px-2 py-2 text-gray-600 dark:text-gray-300 font-semibold">Total</td>
                      {colTotals.map((t, i) => (
                        <td key={`col-total-${i}`} className="px-2 py-2 text-center font-semibold text-gray-600 dark:text-gray-300">
                          {t || ''}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center font-semibold text-gray-900 dark:text-gray-100">
                        {peakTimesTotalCount || 0}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
