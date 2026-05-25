import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { FiTrendingDown, FiTrendingUp } from 'react-icons/fi'
import { SENTIMENT_COLORS } from '../../constants/palette'
import DashboardChartCard from './DashboardChartCard'
import { computePositiveShareDelta, getSentimentGaugePeriodLabel, sentimentTotals } from './chartUi'

const GAUGE_TRACK = '#e8eaed'

const SENTIMENT_OPTIONS = [
  { id: 'positive', label: 'Positive', pctKey: 'positivePct', color: SENTIMENT_COLORS.Positive },
  { id: 'negative', label: 'Negative', pctKey: 'negativePct', color: SENTIMENT_COLORS.Negative },
  { id: 'neutral', label: 'Neutral', pctKey: 'neutralPct', color: SENTIMENT_COLORS.Neutral },
]

function ChartSkeleton({ className = 'h-64' }) {
  return <div className={`w-full rounded-xl bg-gray-100 animate-pulse dark:bg-white/[0.06] ${className}`} />
}

function StatBox({ pct, label, color, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full flex-col overflow-hidden rounded-xl border bg-white text-left transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:bg-gray-950 dark:focus-visible:ring-offset-gray-950 ${
        active
          ? 'border-gray-300 shadow-md ring-2 ring-offset-1 dark:border-gray-600'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:hover:border-gray-600'
      }`}
      style={active ? { boxShadow: `0 0 0 1px ${color}33`, borderColor: `${color}66` } : undefined}
      aria-pressed={active}
    >
      <div className="flex flex-col items-center justify-center px-2 py-4 text-center">
        <p className="text-xl font-bold tabular-nums leading-none text-gray-900 dark:text-gray-100 sm:text-2xl">
          {pct}%
        </p>
        <p className="mt-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: color }} aria-hidden />
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
  const gaugeData = [
    { name: 'value', value: gaugePct, fill: selected.color },
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
          <div className="relative mx-auto w-full max-w-[320px]">
            <div className="h-[11rem] w-full sm:h-[12rem]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 4, left: 4, bottom: 0 }}>
                  <Pie
                    data={gaugeData}
                    dataKey="value"
                    cx="50%"
                    cy="100%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius="56%"
                    outerRadius="100%"
                    paddingAngle={0}
                    stroke="none"
                    cornerRadius={10}
                  >
                    {gaugeData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Centered inside the hollow of the semi-circle arc */}
            <div
              className="pointer-events-none absolute left-1/2 flex w-[52%] max-w-[9rem] -translate-x-1/2 flex-col items-center text-center"
              style={{ top: '36%' }}
            >
              <p className="text-4xl font-bold leading-none tracking-tight text-gray-900 dark:text-gray-100 sm:text-[2.75rem]">
                {gaugePct}%
              </p>
              <p className="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">{selected.label}</p>
              {showComparison && (
                <p className="mt-2 flex flex-wrap items-center justify-center gap-1 text-xs">
                  {delta != null && (
                    <span
                      className={`inline-flex items-center gap-0.5 font-semibold ${
                        delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {delta >= 0 ? (
                        <FiTrendingUp className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <FiTrendingDown className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {Math.abs(delta)}%
                    </span>
                  )}
                  {periodLabel && (
                    <span className="text-gray-400 dark:text-gray-500">vs {periodLabel}</span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            {SENTIMENT_OPTIONS.map((opt) => (
              <StatBox
                key={opt.id}
                pct={sent[opt.pctKey]}
                label={opt.label}
                color={opt.color}
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
