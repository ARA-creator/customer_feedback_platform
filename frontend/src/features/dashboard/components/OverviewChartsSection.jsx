import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { SENTIMENT_COLORS } from '../constants/palette'
import { humanizeSource } from '../utils/insightsMetrics'
import { formatRelativeTime, formatSentimentWord } from '../utils/dashboardFormatters'
import DashboardChartCard from './overview/DashboardChartCard'
import AiInsightBar from './overview/AiInsightBar'
import {
  buildChannelDonutData,
  buildTopicsTableRows,
  sentimentTotals,
  sentimentLegendItems,
  formatTrendAxisDate,
  CHART_TICK,
  CHART_GRID,
  CHART_TOOLTIP,
} from './overview/chartUi'

function ChartSkeleton({ className = 'h-64' }) {
  return <div className={`w-full rounded-xl bg-gray-100 animate-pulse dark:bg-white/[0.06] ${className}`} />
}

function SentimentLegendRow() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-4">
      {sentimentLegendItems().map(({ label, color }) => (
        <span key={label} className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          {label}
        </span>
      ))}
    </div>
  )
}

function sentimentEmoji(label) {
  const s = String(label || '').toLowerCase()
  if (s === 'positive') return '😊'
  if (s === 'negative') return '😞'
  return '😐'
}

function categoryPill(category) {
  const c = String(category || '').toLowerCase()
  if (c.includes('bug') || c.includes('complaint')) {
    return 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
  }
  if (c.includes('compliment') || c.includes('praise')) {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
  }
  return 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200'
}

/**
 * Overview dashboard — mockup-style chart grid + AI insight bar.
 */
export default function OverviewChartsSection({
  isCx,
  analyticsLoading,
  analyticsDelayPassed,
  sentimentChartHasRealData,
  sentimentData,
  insuranceTagsBreakdown,
  isDarkMode: _isDarkMode,
  trendData,
  trendYMax,
  trendAllZero,
  overviewTrendLabels,
  sourcePerformance,
  recentFeedback = [],
  onNavigateToInsights,
  onOpenFeedback,
  analyzerLoading,
  analyzerError,
  analyzerResult,
  overviewTimeFilterLabel,
  onAnalyzerRefresh,
  onAnalyzerDetails,
  analyzerRefreshDisabled,
}) {
  const trendTitle = overviewTrendLabels?.title || 'Sentiment Trend'
  const channelRows = buildChannelDonutData(sourcePerformance)
  const channelTotal = channelRows.reduce((s, r) => s + r.value, 0)
  const topics = buildTopicsTableRows(insuranceTagsBreakdown, { limit: 6 })
  const sent = sentimentTotals(sentimentData)
  const gaugeData = [
    { name: 'positive', value: sent.positivePct || 0, fill: SENTIMENT_COLORS.Positive },
    { name: 'rest', value: Math.max(0, 100 - (sent.positivePct || 0)), fill: '#e5e7eb' },
  ]
  const recent = (Array.isArray(recentFeedback) ? recentFeedback : []).slice(0, 4)

  const priorPositiveShare = (() => {
    const rows = Array.isArray(trendData) ? trendData : []
    if (rows.length < 4) return null
    const mid = Math.floor(rows.length / 2)
    const first = rows.slice(0, mid)
    const second = rows.slice(mid)
    const share = (chunk) => {
      let p = 0
      let t = 0
      for (const d of chunk) {
        p += Number(d.positive) || 0
        t += (Number(d.positive) || 0) + (Number(d.negative) || 0) + (Number(d.neutral) || 0)
      }
      return t > 0 ? (p / t) * 100 : 0
    }
    const a = share(first)
    const b = share(second)
    return Math.round(b - a)
  })()

  const ready = !analyticsLoading && analyticsDelayPassed

  return (
    <div className="space-y-6">
      {/* Row 1: Sentiment trend + Volume by channel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardChartCard
          title={trendTitle}
          action={
            <span className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              Daily
            </span>
          }
        >
          {!ready ? (
            <ChartSkeleton className="h-72" />
          ) : (
            <>
              <SentimentLegendRow />
              {trendAllZero && (
                <p className="mb-3 text-xs text-amber-800 dark:text-amber-200">
                  {overviewTrendLabels?.empty || 'No feedback in this period.'}
                </p>
              )}
              <div
                className={`h-64 sm:h-72 ${onNavigateToInsights ? 'cursor-pointer' : ''}`}
                role={onNavigateToInsights ? 'button' : undefined}
                tabIndex={onNavigateToInsights ? 0 : undefined}
                onClick={() => onNavigateToInsights?.()}
                onKeyDown={(e) => {
                  if (!onNavigateToInsights) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onNavigateToInsights()
                  }
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid {...CHART_GRID} vertical={false} />
                    <XAxis dataKey="date" tick={CHART_TICK} tickFormatter={formatTrendAxisDate} axisLine={false} tickLine={false} />
                    <YAxis tick={CHART_TICK} allowDecimals={false} domain={[0, trendYMax]} axisLine={false} tickLine={false} width={32} />
                    <Tooltip {...CHART_TOOLTIP} labelFormatter={formatTrendAxisDate} />
                    <Line
                      type="monotone"
                      dataKey="positive"
                      name="Positive"
                      stroke={SENTIMENT_COLORS.Positive}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4, fill: SENTIMENT_COLORS.Positive, strokeWidth: 0 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="negative"
                      name="Negative"
                      stroke={SENTIMENT_COLORS.Negative}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4, fill: SENTIMENT_COLORS.Negative, strokeWidth: 0 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="neutral"
                      name="Neutral"
                      stroke={SENTIMENT_COLORS.Neutral}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4, fill: SENTIMENT_COLORS.Neutral, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </DashboardChartCard>

        <DashboardChartCard
          title="Volume by Channel"
          action={
            <span className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              All channels
            </span>
          }
        >
          {!ready ? (
            <ChartSkeleton className="h-72" />
          ) : channelRows.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">No channel volume in this period.</p>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
              <div className="relative h-52 w-52 shrink-0 sm:h-56 sm:w-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channelRows}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="58%"
                      outerRadius="88%"
                      paddingAngle={2}
                      stroke="#fff"
                      strokeWidth={2}
                    >
                      {channelRows.map((entry) => (
                        <Cell key={entry.source} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip {...CHART_TOOLTIP} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                    {channelTotal.toLocaleString()}
                  </span>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total</span>
                </div>
              </div>
              <ul className="w-full min-w-0 flex-1 space-y-2.5">
                {channelRows.map((row) => (
                  <li key={row.source} className="flex items-center justify-between gap-2 text-sm">
                    <span className="inline-flex min-w-0 items-center gap-2 text-gray-800 dark:text-gray-200">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.fill }} aria-hidden />
                      <span className="truncate">{row.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-gray-600 dark:text-gray-400">
                      {row.pct}% <span className="text-gray-400">({row.value})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DashboardChartCard>
      </div>

      {/* Row 2: Topics + Recent + Sentiment breakdown */}
      <div className={`grid grid-cols-1 gap-6 ${isCx ? 'lg:grid-cols-2' : 'xl:grid-cols-3'}`}>
        {!isCx && (
          <DashboardChartCard title="Top Feedback Topics">
            {!ready ? (
              <ChartSkeleton className="h-56" />
            ) : topics.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">No tagged themes in this period.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800">
                        <th className="pb-2 pr-2 font-semibold">Topic</th>
                        <th className="pb-2 pr-2 font-semibold">Sentiment</th>
                        <th className="pb-2 text-right font-semibold">Volume</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {topics.map((row) => (
                        <tr key={row.key}>
                          <td className="py-2.5 pr-2 font-medium text-gray-900 dark:text-gray-100">{row.name}</td>
                          <td className="py-2.5 pr-2">
                            <div className="flex h-2 w-full max-w-[8rem] overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                              <span
                                className="h-full bg-[#D96C6C]"
                                style={{ width: `${row.negPct}%` }}
                                title={`Negative ${Math.round(row.negPct)}%`}
                              />
                              <span
                                className="h-full bg-[#6FBF73]"
                                style={{ width: `${row.posPct}%` }}
                                title={`Positive ${Math.round(row.posPct)}%`}
                              />
                            </div>
                          </td>
                          <td className="py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {onNavigateToInsights && (
                  <button
                    type="button"
                    onClick={() => onNavigateToInsights()}
                    className="mt-4 w-full text-center text-xs font-semibold text-[#009750] hover:text-[#007a42] dark:text-emerald-400"
                  >
                    View all topics →
                  </button>
                )}
              </>
            )}
          </DashboardChartCard>
        )}

        <DashboardChartCard
          title="Recent Feedback"
          action={
            onNavigateToInsights ? (
              <button
                type="button"
                onClick={() => onNavigateToInsights()}
                className="text-xs font-semibold text-[#009750] hover:underline dark:text-emerald-400"
              >
                View all
              </button>
            ) : null
          }
          className={isCx ? 'lg:col-span-1' : ''}
        >
          {!ready ? (
            <ChartSkeleton className="h-56" />
          ) : recent.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">No recent feedback yet.</p>
          ) : (
            <ul className="space-y-4">
              {recent.map((item) => {
                const msg = String(item.message || item.summary || '').trim()
                const preview = msg.length > 72 ? `${msg.slice(0, 72)}…` : msg || '—'
                const sentiment = formatSentimentWord(item.sentiment_label)
                const cat = item.category || sentiment
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onOpenFeedback?.(item)}
                      className="w-full text-left hover:opacity-90"
                    >
                      <div className="flex gap-2">
                        <span className="text-lg leading-none" aria-hidden>
                          {sentimentEmoji(item.sentiment_label)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{preview}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${categoryPill(cat)}`}
                            >
                              {cat || 'Feedback'}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                            {humanizeSource(item.source)} ·{' '}
                            {item.created_at ? formatRelativeTime(item.created_at) : '—'} · {sentiment}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {onNavigateToInsights && recent.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigateToInsights()}
              className="mt-4 w-full text-center text-xs font-semibold text-[#009750] hover:text-[#007a42] dark:text-emerald-400"
            >
              View all feedback →
            </button>
          )}
        </DashboardChartCard>

        <DashboardChartCard title="Sentiment Breakdown" className={isCx ? '' : ''}>
          {!ready ? (
            <ChartSkeleton className="h-56" />
          ) : !sentimentChartHasRealData ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">No sentiment labels yet.</p>
          ) : (
            <>
              <div className="relative mx-auto h-44 w-full max-w-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={gaugeData}
                      dataKey="value"
                      cx="50%"
                      cy="85%"
                      startAngle={180}
                      endAngle={0}
                      innerRadius="55%"
                      outerRadius="85%"
                      stroke="none"
                    >
                      {gaugeData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center">
                  <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{sent.positivePct}%</span>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Positive</span>
                  {priorPositiveShare != null && (
                    <span
                      className={`mt-1 text-xs font-medium ${
                        priorPositiveShare >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {priorPositiveShare >= 0 ? '↑' : '↓'} {Math.abs(priorPositiveShare)}% vs earlier in period
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: 'Positive', pct: sent.positivePct, color: SENTIMENT_COLORS.Positive },
                  { label: 'Negative', pct: sent.negativePct, color: SENTIMENT_COLORS.Negative },
                  { label: 'Neutral', pct: sent.neutralPct, color: SENTIMENT_COLORS.Neutral },
                ].map((box) => (
                  <div
                    key={box.label}
                    className="overflow-hidden rounded-lg border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50"
                  >
                    <div className="px-2 py-2 text-center">
                      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{box.label}</p>
                      <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{box.pct}%</p>
                    </div>
                    <div className="h-1 w-full" style={{ backgroundColor: box.color }} aria-hidden />
                  </div>
                ))}
              </div>
            </>
          )}
        </DashboardChartCard>
      </div>

      {/* AI Insight — full width below charts */}
      <AiInsightBar
        loading={analyzerLoading}
        error={analyzerError}
        result={analyzerResult}
        timeFilterLabel={overviewTimeFilterLabel}
        onRefresh={onAnalyzerRefresh}
        onViewDetails={onAnalyzerDetails}
        refreshDisabled={analyzerRefreshDisabled}
      />
    </div>
  )
}
