import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { FiTrendingDown, FiTrendingUp } from 'react-icons/fi'
import { SENTIMENT_COLORS } from '../../constants/palette'
import DashboardChartCard from './DashboardChartCard'
import { computePositiveShareDelta, getSentimentGaugePeriodLabel, sentimentTotals } from './chartUi'

const GAUGE_TRACK = '#e8eaed'

const SENTIMENT_OPTIONS = [
  { id: 'positive', label: 'Positive', pctKey: 'positivePct', color: SENTIMENT_COLORS.Positive, gauge: '#22c55e' },
  { id: 'negative', label: 'Negative', pctKey: 'negativePct', color: SENTIMENT_COLORS.Negative, gauge: SENTIMENT_COLORS.Negative },
  { id: 'neutral', label: 'Neutral', pctKey: 'neutralPct', color: SENTIMENT_COLORS.Neutral, gauge: SENTIMENT_COLORS.Neutral },
]

function ChartSkeleton({ className = 'h-64' }) {
  return <div className={`w-full rounded-xl bg-gray-100 animate-pulse dark:bg-white/[0.06] ${className}`} />
}

function SentimentStatCard({ pct, label, accentColor, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`flex w-full flex-col overflow-hidden rounded-xl border bg-white text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750]/35 dark:bg-gray-950 ${
        active
          ? 'border-gray-300 shadow-sm dark:border-gray-600'
          : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex flex-col items-center justify-center px-2 pb-4 pt-5">
        <p className="text-2xl font-bold leading-none tabular-nums tracking-tight text-gray-900 dark:text-gray-100">
          {pct}%
        </p>
        <p className="mt-2 text-sm font-normal text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <div className="h-2 w-full shrink-0" style={{ backgroundColor: accentColor }} aria-hidden />
    </button>
  )
}

export default function SentimentBreakdownCard({
  ready,
  sentimentChartHasRealData,
  sentimentData,
  trendData,
}) {
  const [selectedId, setSelectedId] = useState('positive')
  const sent = sentimentTotals(sentimentData)
  const selected = SENTIMENT_OPTIONS.find((o) => o.id === selectedId) || SENTIMENT_OPTIONS[0]
  const gaugePct = sent[selected.pctKey] || 0
  const gaugeFill = selected.gauge || selected.color
  const gaugeData = [
    { name: 'value', value: gaugePct, fill: gaugeFill },
    { name: 'rest', value: Math.max(0, 100 - gaugePct), fill: GAUGE_TRACK },
  ]
  const delta = selectedId === 'positive' ? computePositiveShareDelta(trendData) : null
  const periodLabel = getSentimentGaugePeriodLabel(trendData)
  const showComparison = selectedId === 'positive' && (delta != null || periodLabel)

  return (
    <DashboardChartCard title="Sentiment Breakdown">
      {!ready ? (
        <ChartSkeleton className="h-64" />
      ) : !sentimentChartHasRealData ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">No sentiment labels yet.</p>
      ) : (
        <div className="flex flex-col">
          {/* Gauge + in-arc labels */}
          <div className="relative mx-auto w-full max-w-[300px]">
            <div className="h-[10.5rem] w-full sm:h-[11.5rem]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Pie
                    data={gaugeData}
                    dataKey="value"
                    cx="50%"
                    cy="100%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius="54%"
                    outerRadius="100%"
                    paddingAngle={0}
                    stroke="none"
                    cornerRadius={12}
                  >
                    {gaugeData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="pointer-events-none absolute left-1/2 top-[42%] w-full max-w-[10rem] -translate-x-1/2 -translate-y-1/2 text-center">
              <p className="text-[2.75rem] font-bold leading-none tracking-tight text-gray-900 dark:text-gray-100">
                {gaugePct}%
              </p>
              <p className="mt-1.5 text-sm font-normal text-gray-500 dark:text-gray-400">{selected.label}</p>
            </div>
          </div>

          {/* Trend — directly under gauge, outside the arc */}
          {showComparison ? (
            <p className="mt-1 flex flex-wrap items-center justify-center gap-1 text-center text-xs sm:text-sm">
              {delta != null ? (
                <span
                  className={`inline-flex items-center gap-0.5 font-semibold ${
                    delta >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {delta >= 0 ? (
                    <FiTrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  ) : (
                    <FiTrendingDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  )}
                  {Math.abs(delta)}%
                </span>
              ) : null}
              {periodLabel ? (
                <span className="font-normal text-gray-400 dark:text-gray-500">vs {periodLabel}</span>
              ) : null}
            </p>
          ) : (
            <div className="mt-1 h-5" aria-hidden />
          )}

          {/* Category filters */}
          <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
            {SENTIMENT_OPTIONS.map((opt) => (
              <SentimentStatCard
                key={opt.id}
                pct={sent[opt.pctKey]}
                label={opt.label}
                accentColor={opt.color}
                active={selectedId === opt.id}
                onSelect={() => setSelectedId(opt.id)}
              />
            ))}
          </div>
        </div>
      )}
    </DashboardChartCard>
  )
}
