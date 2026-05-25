import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { FiTrendingDown, FiTrendingUp } from 'react-icons/fi'
import { SENTIMENT_COLORS } from '../../constants/palette'
import DashboardChartCard from './DashboardChartCard'
import { computeSentimentShareDelta, getSentimentGaugePeriodLabel, sentimentTotals } from './chartUi'

const GAUGE_TRACK = '#e8eaed'

const SENTIMENT_OPTIONS = [
  { id: 'positive', label: 'Positive', pctKey: 'positivePct', color: SENTIMENT_COLORS.Positive, gauge: '#22c55e' },
  { id: 'negative', label: 'Negative', pctKey: 'negativePct', color: SENTIMENT_COLORS.Negative, gauge: SENTIMENT_COLORS.Negative },
  { id: 'neutral', label: 'Neutral', pctKey: 'neutralPct', color: SENTIMENT_COLORS.Neutral, gauge: SENTIMENT_COLORS.Neutral },
]

function ChartSkeleton({ className = 'h-64' }) {
  return <div className={`w-full rounded-xl bg-gray-100 animate-pulse dark:bg-white/[0.06] ${className}`} />
}

/** Trend colors: for negative, a drop in share is the favorable direction. */
function trendPresentation(sentimentId, delta) {
  if (delta == null || delta === 0) {
    return {
      Icon: FiTrendingUp,
      valueClass: 'text-gray-500 dark:text-gray-400',
      iconClass: 'text-gray-400',
    }
  }
  const up = delta > 0
  if (sentimentId === 'negative') {
    const favorable = !up
    return {
      Icon: up ? FiTrendingUp : FiTrendingDown,
      valueClass: favorable ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500',
      iconClass: favorable ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500',
    }
  }
  if (sentimentId === 'neutral') {
    return {
      Icon: up ? FiTrendingUp : FiTrendingDown,
      valueClass: 'text-amber-700 dark:text-amber-400',
      iconClass: 'text-amber-600 dark:text-amber-400',
    }
  }
  return {
    Icon: up ? FiTrendingUp : FiTrendingDown,
    valueClass: up ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500',
    iconClass: up ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500',
  }
}

function SentimentTrendComparison({ sentimentId, delta, periodLabel, accentColor }) {
  if (!periodLabel && delta == null) {
    return <div className="mt-2 h-8" aria-hidden />
  }

  const { Icon, valueClass, iconClass } = trendPresentation(sentimentId, delta)

  return (
    <div className="mt-2 flex justify-center px-1">
      <p
        className="inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-full border border-gray-100 bg-gray-50/90 px-3 py-1.5 text-center text-xs shadow-sm dark:border-gray-800 dark:bg-gray-900/60"
        style={{ boxShadow: `0 1px 2px rgba(15,23,42,0.04), 0 0 0 1px ${accentColor}18` }}
      >
        {delta != null ? (
          <>
            <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} aria-hidden />
            <span className={`font-semibold tabular-nums ${valueClass}`}>
              {delta > 0 ? '+' : ''}
              {delta}%
            </span>
          </>
        ) : null}
        {periodLabel ? (
          <span className="font-normal text-gray-500 dark:text-gray-400">
            {delta != null ? 'vs ' : ''}
            {periodLabel}
          </span>
        ) : null}
      </p>
    </div>
  )
}

function SentimentStatCard({ pct, label, accentColor, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`flex w-full flex-col overflow-hidden rounded-xl border bg-white text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:bg-gray-950 dark:focus-visible:ring-offset-gray-950 ${
        active
          ? 'border-gray-300 shadow-md dark:border-gray-600'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:hover:border-gray-600'
      }`}
      style={
        active
          ? {
              boxShadow: `0 4px 14px ${accentColor}22, 0 0 0 1px ${accentColor}44`,
            }
          : undefined
      }
    >
      {active ? (
        <div className="h-1 w-full shrink-0" style={{ backgroundColor: accentColor }} aria-hidden />
      ) : null}
      <div className={`flex flex-col items-center justify-center px-2 ${active ? 'pb-4 pt-4' : 'pb-4 pt-5'}`}>
        <p className="text-2xl font-bold leading-none tabular-nums tracking-tight text-gray-900 sm:text-3xl dark:text-gray-100">
          {pct}%
        </p>
        <p className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
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

  const periodLabel = useMemo(() => getSentimentGaugePeriodLabel(trendData), [trendData])
  const delta = useMemo(
    () => computeSentimentShareDelta(trendData, selectedId),
    [trendData, selectedId],
  )

  return (
    <DashboardChartCard title="Sentiment Breakdown">
      {!ready ? (
        <ChartSkeleton className="h-64" />
      ) : !sentimentChartHasRealData ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">No sentiment labels yet.</p>
      ) : (
        <div className="flex flex-col">
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
              <p className="text-3xl font-bold leading-none tabular-nums tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100">
                {gaugePct}%
              </p>
              <p className="mt-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">{selected.label}</p>
            </div>
          </div>

          <SentimentTrendComparison
            sentimentId={selectedId}
            delta={delta}
            periodLabel={periodLabel}
            accentColor={selected.color}
          />

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
