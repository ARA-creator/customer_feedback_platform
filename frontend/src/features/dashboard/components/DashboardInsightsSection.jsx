import { useState } from 'react'
import { FiAlertTriangle, FiBarChart2, FiThumbsDown, FiThumbsUp } from 'react-icons/fi'
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
import { buildPeakPreset } from '../utils/insightsInboxPreset'
import {
  buildInsightBrief,
  buildTopNegativeIssues,
  buildTopThemes,
  fmtPct,
  humanizeSource,
} from '../utils/insightsMetrics'
import InsightBriefBanner from './insights/InsightBriefBanner'
import ThemeLandscapeCard from './insights/ThemeLandscapeCard'
import ChannelMonitorsCard from './insights/ChannelMonitorsCard'
import SourceThemeMatrixCard from './insights/SourceThemeMatrixCard'
import InsightsInvestigateBar from './insights/InsightsInvestigateBar'
import InsightsSectionCard from './insights/InsightsSectionCard'

function clamp(n, min, max) {
  const x = Number(n)
  if (!Number.isFinite(x)) return min
  return Math.min(max, Math.max(min, x))
}

function fmtDayLabel(iso) {
  if (!iso) return ''
  const s = String(iso)
  const parts = s.split('-')
  if (parts.length >= 3) return `${parts[1]}/${parts[2]}`
  return s
}

function StatCard({ label, value, sub, accent = 'slate', trackPct = 100 }) {
  const tintMap = {
    slate: 'metric-card--tint-total',
    teal: 'metric-card--tint-positive',
    rose: 'metric-card--tint-negative',
    amber: 'metric-card--tint-priority',
    emerald: 'metric-card--tint-positive',
  }
  const iconMap = {
    slate: FiBarChart2,
    teal: FiThumbsUp,
    rose: FiThumbsDown,
    amber: FiAlertTriangle,
    emerald: FiThumbsUp,
  }
  const tintClass = tintMap[accent] || tintMap.slate
  const Icon = iconMap[accent] || FiBarChart2
  const pct = Math.max(0, Math.min(100, Number(trackPct) || 0))
  return (
    <div className={`metric-card metric-card--kpi ${tintClass}`} style={{ '--kpi-pct': `${pct}%` }}>
      <div className="metric-card__body">
        <div className="metric-card__icon" aria-hidden>
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </div>
        <div className="metric-card__text">
          <p className="metric-card__value">{value}</p>
          <p className="metric-card__label">{label}</p>
        </div>
      </div>
      <div className="metric-card__footer">
        <div className="metric-card__track" aria-hidden>
          <div className="metric-card__track-fill" />
        </div>
        {sub ? <p className="mt-1.5 text-center text-[11px] text-gray-500 dark:text-gray-400">{sub}</p> : null}
      </div>
    </div>
  )
}

export default function DashboardInsightsSection({
  onNavigateBack,
  onNavigateToInbox,
  insightsProductKey,
  setInsightsProductKey,
  insightsProductOptions,
  timeWindow = 'all',
  timeWindowLabel = 'All time',
  sentimentFilter = 'all',
  statusFilter = 'all',
  analyticsLoading,
  analyticsDelayPassed,
  isDarkMode,
  trendData,
  metrics,
  productPulseTrendPivot,
  insuranceTagsBreakdown,
  insuranceTagsTrends,
  sourceThemeMatrix,
  categoryData: _categoryData,
  categoryNegativeMap,
  sourceTrends,
  sourceTrendColors,
  sourcePerformance,
  peakTimes,
  peakTimesTotalCount,
  peakTimesMaxCount,
  heatmapHover,
  setHeatmapHover,
}) {
  const [selectedThemeKey, setSelectedThemeKey] = useState('')
  const [selectedSourceKey, setSelectedSourceKey] = useState('')

  const rangeLabel = timeWindowLabel
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

  const topThemes = buildTopThemes(insuranceTagsBreakdown, 8)

  const toggleTheme = (key) => {
    setSelectedThemeKey((prev) => (prev === key ? '' : key))
  }
  const toggleSource = (key) => {
    setSelectedSourceKey((prev) => (prev === key ? '' : key))
  }
  const selectCell = (src, theme) => {
    setSelectedSourceKey(src)
    setSelectedThemeKey(theme)
  }
  const clearSelection = () => {
    setSelectedThemeKey('')
    setSelectedSourceKey('')
  }

  const peakHeatmapSubtitle =
    selectedThemeKey || selectedSourceKey
      ? 'Click a peak cell for time-of-week drill-down. Theme and channel filters apply when you open inbox from Investigate above.'
      : 'Counts by day and hour (UTC). Color reflects sentiment balance; intensity reflects volume. Click a cell to open inbox for that slot.'

  const topIssuesChartRows = buildTopNegativeIssues(insuranceTagsBreakdown, categoryNegativeMap, 8)

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
      const brief = buildInsightBrief({
        topThemes,
        sourcePerformance,
        metrics,
        rangeLabel,
      })
      const payload = {
        time_window: timeWindow,
        time_window_label: rangeLabel,
        sentiment: sentimentFilter || 'all',
        product_scope: insightsProductKey || 'all',
        generated_at: new Date().toISOString(),
        metrics,
        brief,
        selected_theme: selectedThemeKey || null,
        selected_source: selectedSourceKey || null,
        source_theme_matrix: sourceThemeMatrix,
        source_totals: sourceTotals,
        sentiment_trend: sentimentSeries,
        top_themes: topThemes,
        top_issues: topIssuesChartRows.rows,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customer-pulse-insights-${timeWindow || 'all'}.json`
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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
            Period · {rangeLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            id="insights-product-filter"
            value={insightsProductKey}
            onChange={(e) => setInsightsProductKey(e.target.value)}
            className="min-h-[40px] max-w-[min(100vw-2rem,18rem)] rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009750]/25 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            aria-label="Filter insights by product name"
          >
            <option value="">All products</option>
            {insightsProductOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={exportInsights}
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#009750] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#007a42] focus:outline-none focus:ring-2 focus:ring-[#009750]/25"
            title="Export insights (JSON)"
          >
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Total feedback"
          value={Number(metrics?.totalFeedback ?? 0) || 0}
          sub={insightsProductKey ? 'Filtered by product' : 'All products'}
          accent="slate"
          trackPct={100}
        />
        <StatCard
          label="Positive share"
          value={fmtPct((Number(metrics?.positive ?? 0) || 0) / Math.max(1, Number(metrics?.totalFeedback ?? 0) || 0))}
          sub={`${Number(metrics?.positive ?? 0) || 0} positive`}
          accent="teal"
          trackPct={((Number(metrics?.positive ?? 0) || 0) / Math.max(1, Number(metrics?.totalFeedback ?? 0) || 0)) * 100}
        />
        <StatCard
          label="Negative share"
          value={fmtPct((Number(metrics?.negative ?? 0) || 0) / Math.max(1, Number(metrics?.totalFeedback ?? 0) || 0))}
          sub={`${Number(metrics?.negative ?? 0) || 0} negative`}
          accent="rose"
          trackPct={((Number(metrics?.negative ?? 0) || 0) / Math.max(1, Number(metrics?.totalFeedback ?? 0) || 0)) * 100}
        />
        <StatCard
          label="High priority"
          value={Number(metrics?.highPriority ?? 0) || 0}
          sub="Requires fast triage"
          accent="amber"
          trackPct={((Number(metrics?.highPriority ?? 0) || 0) / Math.max(1, Number(metrics?.totalFeedback ?? 0) || 0)) * 100}
        />
      </div>

      <InsightBriefBanner
        topThemes={topThemes}
        sourcePerformance={sourcePerformance}
        metrics={metrics}
        timeWindowLabel={rangeLabel}
        selectedThemeKey={selectedThemeKey}
        selectedSourceKey={selectedSourceKey}
        onSelectTheme={toggleTheme}
        onSelectSource={toggleSource}
      />

      <InsightsInvestigateBar
        selectedThemeKey={selectedThemeKey}
        selectedSourceKey={selectedSourceKey}
        timeWindow={timeWindow}
        timeWindowLabel={rangeLabel}
        sentimentFilter={sentimentFilter}
        statusFilter={statusFilter}
        onClear={clearSelection}
        onNavigateToInbox={onNavigateToInbox}
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ThemeLandscapeCard
            insuranceTagsBreakdown={insuranceTagsBreakdown}
            insuranceTagsTrends={insuranceTagsTrends}
            metrics={metrics}
            timeWindow={timeWindow}
            sentimentFilter={sentimentFilter}
            statusFilter={statusFilter}
            selectedThemeKey={selectedThemeKey}
            onSelectTheme={toggleTheme}
            onNavigateToInbox={onNavigateToInbox}
            loading={loadingState}
          />
          <SourceThemeMatrixCard
            sourceThemeMatrix={sourceThemeMatrix}
            selectedThemeKey={selectedThemeKey}
            selectedSourceKey={selectedSourceKey}
            onSelectCell={selectCell}
            isDarkMode={isDarkMode}
            loading={loadingState}
          />
        </div>
        <ChannelMonitorsCard
          sourcePerformance={sourcePerformance}
          sourceTrends={sourceTrends}
          metrics={metrics}
          timeWindow={timeWindow}
          sentimentFilter={sentimentFilter}
          statusFilter={statusFilter}
          selectedSourceKey={selectedSourceKey}
          onSelectSource={toggleSource}
          onNavigateToInbox={onNavigateToInbox}
          loading={loadingState}
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <InsightsSectionCard
          title="Source trend"
          subtitle="Daily volume by top channels (others grouped)."
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
        </InsightsSectionCard>

        <InsightsSectionCard
          title="Top issues"
          subtitle="Themes with the most negative feedback in this window."
        >
          {loadingState ? (
            <div className="w-full h-72 rounded-2xl bg-gray-50 dark:bg-gray-900/40 animate-pulse" />
          ) : topIssuesEmpty ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              No negative feedback by theme in this range yet.
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
                  <Bar dataKey="value" name="Negative" radius={[10, 10, 10, 10]}>
                    {topIssuesChartRows.rows.map((row, idx) => (
                      <Cell key={`issue-${row.name}-${idx}`} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </InsightsSectionCard>

        <InsightsSectionCard
          className="lg:col-span-2"
          title="Peak feedback times"
          subtitle={peakHeatmapSubtitle}
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
                <table className="w-full table-fixed text-xs">
                  <thead>
                    <tr>
                      <th className="w-16 px-2 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold">Hour</th>
                      {days.map((label, i) => (
                        <th key={label} className="px-2 py-2 text-center text-gray-500 dark:text-gray-400 font-semibold">
                          <span className="inline-flex items-center justify-center gap-2">
                            {label}
                            <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">
                              {colTotals[i] || 0}
                            </span>
                          </span>
                        </th>
                      ))}
                      <th className="w-16 px-2 py-2 text-center text-gray-500 dark:text-gray-400 font-semibold">Total</th>
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
                                onNavigateToInbox?.(buildPeakPreset({ dow, hour, timeWindow }))
                              }}
                              role={canClick ? 'button' : undefined}
                              tabIndex={canClick ? 0 : undefined}
                              onKeyDown={(e) => {
                                if (!canClick) return
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  onNavigateToInbox?.(buildPeakPreset({ dow, hour, timeWindow }))
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
        </InsightsSectionCard>
      </div>
    </div>
  )
}
