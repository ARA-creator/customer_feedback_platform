import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { FiTrendingDown, FiTrendingUp } from 'react-icons/fi'
import { SENTIMENT_COLORS } from '../../constants/palette'
import DashboardChartCard from './DashboardChartCard'
import { computePositiveShareDelta, getSentimentGaugePeriodLabel, sentimentTotals } from './chartUi'

const GAUGE_TRACK = '#e8eaed'
const GAUGE_POSITIVE = '#22c55e'

function ChartSkeleton({ className = 'h-64' }) {
  return <div className={`w-full rounded-xl bg-gray-100 animate-pulse dark:bg-white/[0.06] ${className}`} />
}

function StatBox({ pct, label, color }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950">
      <div className="flex flex-col items-center justify-center px-2 py-4 text-center">
        <p className="text-xl font-bold tabular-nums leading-none text-gray-900 dark:text-gray-100 sm:text-2xl">
          {pct}%
        </p>
        <p className="mt-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: color }} aria-hidden />
    </div>
  )
}

export default function SentimentBreakdownCard({
  ready,
  sentimentChartHasRealData,
  sentimentData,
  trendData,
}) {
  const sent = sentimentTotals(sentimentData)
  const positivePct = sent.positivePct || 0
  const gaugeData = [
    { name: 'positive', value: positivePct, fill: GAUGE_POSITIVE },
    { name: 'rest', value: Math.max(0, 100 - positivePct), fill: GAUGE_TRACK },
  ]
  const delta = computePositiveShareDelta(trendData)
  const periodLabel = getSentimentGaugePeriodLabel(trendData)
  const showComparison = delta != null || periodLabel

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
            <div className="pointer-events-none absolute inset-x-0 bottom-8 flex flex-col items-center text-center sm:bottom-10">
              <p className="text-4xl font-bold leading-none tracking-tight text-gray-900 dark:text-gray-100 sm:text-[2.75rem]">
                {positivePct}%
              </p>
              <p className="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">Positive</p>
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
            <StatBox pct={sent.positivePct} label="Positive" color={SENTIMENT_COLORS.Positive} />
            <StatBox pct={sent.negativePct} label="Negative" color={SENTIMENT_COLORS.Negative} />
            <StatBox pct={sent.neutralPct} label="Neutral" color={SENTIMENT_COLORS.Neutral} />
          </div>
        </div>
      )}
    </DashboardChartCard>
  )
}
