import { useMemo, useState } from 'react'
import { FiInfo } from 'react-icons/fi'
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { SENTIMENT_COLORS } from '../../constants/palette'
import DashboardChartCard from './DashboardChartCard'
import ChartFilterSelect from './ChartFilterSelect'
import {
  aggregateTrendSeries,
  CHART_GRID,
  CHART_TICK,
  CHART_TOOLTIP,
  formatTrendAxisDate,
  sentimentLegendItems,
  toTrendPercentSeries,
  TREND_GRANULARITY_OPTIONS,
  TREND_PERCENT_Y_DOMAIN,
  TREND_PERCENT_Y_TICKS,
} from './chartUi'

function ChartSkeleton({ className = 'h-72' }) {
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

function lastPointDot(color, lastIndex, seriesId) {
  // Recharts maps one element per point. Always return a keyed node (r=0 when hidden)
  // so React does not warn about missing keys in the Line dots list.
  return function TrendEndDot({ cx, cy, index }) {
    if (cx == null || cy == null) return null
    const isEnd = index === lastIndex
    return (
      <circle
        key={`${seriesId}-dot-${index}`}
        cx={cx}
        cy={cy}
        r={isEnd ? 5 : 0}
        fill={color}
        stroke={isEnd ? '#fff' : 'none'}
        strokeWidth={isEnd ? 2 : 0}
      />
    )
  }
}

export default function SentimentTrendCard({
  ready,
  trendTitle = 'Sentiment Trend',
  trendData = [],
  trendAllZero,
  overviewTrendLabels,
  onNavigateToInsights,
}) {
  const [granularity, setGranularity] = useState('daily')

  const chartData = useMemo(() => {
    const aggregated = aggregateTrendSeries(trendData, granularity)
    return toTrendPercentSeries(aggregated)
  }, [trendData, granularity])

  const lastIndex = Math.max(0, chartData.length - 1)

  const titleNode = (
    <span className="inline-flex items-center gap-1.5">
      {trendTitle}
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
        title="Share of feedback by sentiment for each day in the selected period"
      >
        <FiInfo className="h-3 w-3" aria-hidden />
      </span>
    </span>
  )

  return (
    <DashboardChartCard
      title={titleNode}
      action={
        <ChartFilterSelect
          value={granularity}
          onChange={setGranularity}
          options={TREND_GRANULARITY_OPTIONS}
          ariaLabel="Trend granularity"
        />
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
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid {...CHART_GRID} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={CHART_TICK}
                  tickFormatter={formatTrendAxisDate}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  tick={CHART_TICK}
                  domain={TREND_PERCENT_Y_DOMAIN}
                  ticks={TREND_PERCENT_Y_TICKS}
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  {...CHART_TOOLTIP}
                  labelFormatter={formatTrendAxisDate}
                  formatter={(value, name) => [`${value}%`, name]}
                />
                <Line
                  type="monotone"
                  dataKey="positive"
                  name="Positive"
                  stroke={SENTIMENT_COLORS.Positive}
                  strokeWidth={2.5}
                  dot={lastPointDot(SENTIMENT_COLORS.Positive, lastIndex, 'positive')}
                  activeDot={{ r: 4, fill: SENTIMENT_COLORS.Positive, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="negative"
                  name="Negative"
                  stroke={SENTIMENT_COLORS.Negative}
                  strokeWidth={2.5}
                  dot={lastPointDot(SENTIMENT_COLORS.Negative, lastIndex, 'negative')}
                  activeDot={{ r: 4, fill: SENTIMENT_COLORS.Negative, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="neutral"
                  name="Neutral"
                  stroke={SENTIMENT_COLORS.Neutral}
                  strokeWidth={2.5}
                  dot={lastPointDot(SENTIMENT_COLORS.Neutral, lastIndex, 'neutral')}
                  activeDot={{ r: 4, fill: SENTIMENT_COLORS.Neutral, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </DashboardChartCard>
  )
}
