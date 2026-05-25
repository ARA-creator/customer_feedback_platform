import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { FiTrendingDown, FiTrendingUp } from 'react-icons/fi'
import { SENTIMENT_COLORS } from '../../constants/palette'
import DashboardChartCard from './DashboardChartCard'
import { computePositiveShareDelta, getSentimentGaugePeriodLabel, sentimentTotals } from './chartUi'

const GAUGE_TRACK = '#e8eaed'
const GAUGE_POSITIVE = SENTIMENT_COLORS.Positive

function ChartSkeleton({ className = 'h-56' }) {
  return <div className={`w-full rounded-xl bg-gray-100 animate-pulse dark:bg-white/[0.06] ${className}`} />
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
        <ChartSkeleton className="h-52" />
      ) : !sentimentChartHasRealData ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">No sentiment labels yet.</p>
      ) : (
        <div className="flex flex-col items-center px-2 pb-1">
          <div className="relative w-full max-w-[300px]">
            <div className="h-[9.5rem] w-full sm:h-[10rem]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                  <Pie
                    data={gaugeData}
                    dataKey="value"
                    cx="50%"
                    cy="100%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius="68%"
                    outerRadius="100%"
                    paddingAngle={0}
                    stroke="none"
                    cornerRadius={8}
                  >
                    {gaugeData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center text-center sm:bottom-7">
              <p className="text-[2.5rem] font-bold leading-none tracking-tight text-gray-900 dark:text-gray-100 sm:text-[2.75rem]">
                {positivePct}%
              </p>
              <p className="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">Positive</p>
            </div>
          </div>

          {showComparison && (
            <p className="mt-1 flex flex-wrap items-center justify-center gap-1 text-sm">
              {delta != null && (
                <span
                  className={`inline-flex items-center gap-0.5 font-semibold ${
                    delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {delta >= 0 ? (
                    <FiTrendingUp className="h-4 w-4" aria-hidden />
                  ) : (
                    <FiTrendingDown className="h-4 w-4" aria-hidden />
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
      )}
    </DashboardChartCard>
  )
}
