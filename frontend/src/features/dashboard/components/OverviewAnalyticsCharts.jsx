import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts'
import { VIRIDIS, SENTIMENT_COLORS } from '../constants/palette'

/**
 * Overview tab: sentiment + insurance tags row, product pulse, 30d sentiment trend.
 * Extracted from Dashboard.jsx to keep the main view manageable.
 */
export default function OverviewAnalyticsCharts({
  isDarkMode,
  isCx,
  analyticsLoading,
  analyticsDelayPassed,
  sentimentChartHasRealData,
  sentimentData,
  categoryChartHasRealData,
  overviewPeriod,
  insuranceTagsBarChartData,
  productPulse,
  trendData,
  trendYMax,
  trendAllZero,
  onNavigateToInsights,
}) {
  const trendTitle = overviewPeriod?.trend?.title || 'Sentiment Trend'
  const trendEmptyMessage =
    overviewPeriod?.trend?.empty ||
    'No feedback for the selected period. The chart shows daily counts at zero for this period.'
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      const total = sentimentData.reduce((sum, item) => sum + item.value, 0)
      const percentage = total > 0 ? Math.round((data.value / total) * 100) : 0
      return (
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg dark:bg-gray-900 dark:border-gray-700">
          <p className="text-gray-900 dark:text-gray-100 font-semibold">{data.name}</p>
          <p className="text-gray-600 dark:text-gray-300 text-sm">Count: {data.value}</p>
          <p className="text-gray-600 dark:text-gray-300 text-sm">Percentage: {percentage}%</p>
        </div>
      )
    }
    return null
  }

  return (
    <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sentiment Distribution */}
            <div className="card p-4 sm:p-6">
              <h2
                className={`text-lg font-semibold text-gray-900 dark:text-gray-100 ${
                  !analyticsLoading && analyticsDelayPassed && !sentimentChartHasRealData
                    ? 'mb-1'
                    : 'mb-6'
                }`}
              >
                Sentiment Distribution
              </h2>
              {!analyticsLoading && analyticsDelayPassed && !sentimentChartHasRealData && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                  No labeled feedback yet, or counts are zero. Submit or import feedback to see a breakdown.
                </p>
              )}
              {analyticsLoading || !analyticsDelayPassed ? (
                <div className="w-full h-[400px] bg-gray-50 rounded-xl animate-pulse" />
              ) : sentimentChartHasRealData ? (
                <div className="flex flex-col items-center">
                  <div className="w-full max-w-md" style={{ height: '320px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sentimentData}
                          cx="50%"
                          cy="50%"
                          innerRadius="48%"
                          outerRadius="78%"
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="name"
                          labelLine={false}
                          stroke="#fff"
                          strokeWidth={2}
                        >
                          {sentimentData.map((entry, index) => (
                            <Cell key={`sentiment-${entry.name}-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-4 w-full px-2">
                    {sentimentData.map((entry, index) => {
                      const total = sentimentData.reduce((sum, item) => sum + item.value, 0)
                      const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0
                      return (
                        <div
                          key={`legend-${entry.name}-${index}`}
                          className="flex items-center gap-2 text-sm text-gray-700"
                        >
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: entry.color }}
                            aria-hidden
                          />
                          <span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{entry.name}</span>
                          <span className="text-gray-600 dark:text-gray-300">
                              {' '}
                              ({entry.value}
                              {` · ${percentage}%`})
                            </span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-full max-w-md aspect-square max-h-[320px] relative">
                    <div
                      className="absolute inset-[10%] rounded-full border-[14px] border-gray-200 dark:border-gray-700"
                      aria-hidden
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Total</div>
                        <div className="mt-0.5 text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">0</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Insurance tags (horizontal bars) */}
            {!isCx && (
            <div className="card p-4 sm:p-6">
              <div
                className={`flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between ${
                  !analyticsLoading && analyticsDelayPassed && !categoryChartHasRealData
                    ? 'mb-1'
                    : 'mb-6'
                }`}
              >
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Insurance tags</h2>
                <span className="text-xs text-gray-500 dark:text-gray-400 sm:text-right">
                  {overviewPeriod?.themes?.subtitle}
                </span>
              </div>
              {!analyticsLoading && analyticsDelayPassed && !categoryChartHasRealData && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                  {overviewPeriod?.themes?.empty}
                </p>
              )}
              {analyticsLoading || !analyticsDelayPassed ? (
                <div className="w-full h-[400px] bg-gray-50 rounded-xl animate-pulse" />
              ) : (
                <div
                  style={{
                    height: `${Math.max(360, Math.min(520, insuranceTagsBarChartData.length * 44 + 80))}px`,
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={insuranceTagsBarChartData}
                      margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                      barCategoryGap="18%"
                    >
                      <XAxis
                        type="number"
                        tick={{ fill: isDarkMode ? '#e5e7eb' : '#6b7280', fontSize: 12 }}
                        axisLine={{ stroke: isDarkMode ? '#374151' : '#e5e7eb' }}
                        tickLine={{ stroke: isDarkMode ? '#374151' : '#e5e7eb' }}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={128}
                        tick={{ fill: isDarkMode ? '#f3f4f6' : '#374151', fontSize: 12 }}
                        axisLine={{ stroke: isDarkMode ? '#374151' : '#e5e7eb' }}
                        tickLine={false}
                        interval={0}
                      />
                      <CartesianGrid
                        strokeDasharray="4 4"
                        stroke={isDarkMode ? 'rgba(148,163,184,0.35)' : '#e5e7eb'}
                        horizontal={false}
                        vertical
                      />
                      <Tooltip
                        cursor={{
                          fill: isDarkMode ? 'rgba(111, 191, 115, 0.14)' : 'rgba(111, 191, 115, 0.08)',
                        }}
                        contentStyle={{
                          backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                          border: isDarkMode ? '1px solid rgba(255,255,255,0.10)' : '1px solid #d1d5db',
                          borderRadius: '8px',
                          color: isDarkMode ? '#f9fafb' : '#1f2937',
                          boxShadow: isDarkMode
                            ? '0 10px 25px rgba(15,23,42,0.35)'
                            : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        }}
                        labelStyle={{ color: isDarkMode ? '#e5e7eb' : '#111827', fontSize: 11 }}
                        formatter={(value) => [value, 'Count']}
                        labelFormatter={(label) => String(label)}
                      />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={22} maxBarSize={28}>
                        {insuranceTagsBarChartData.map((entry) => (
                          <Cell key={entry._key || entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
          </div>

          {/* Product pulse (volume by product) */}
          <div className="mt-6 card p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Product breakdown</h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Volume by product · window matches the Overview filter
              </span>
            </div>
            {analyticsLoading || !analyticsDelayPassed ? (
              <div className="w-full h-[320px] bg-gray-50 rounded-xl animate-pulse" />
            ) : productPulse.length === 0 ? (
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                No product/policy matches in this time window yet.
              </p>
            ) : (
              <div className="mt-4" style={{ height: `${Math.max(280, Math.min(520, productPulse.length * 42 + 120))}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={productPulse} margin={{ top: 8, right: 16, left: 8, bottom: 8 }} barCategoryGap="18%">
                    <XAxis
                      type="number"
                      tick={{ fill: isDarkMode ? '#e5e7eb' : '#6b7280', fontSize: 12 }}
                      axisLine={{ stroke: isDarkMode ? '#374151' : '#e5e7eb' }}
                      tickLine={{ stroke: isDarkMode ? '#374151' : '#e5e7eb' }}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={160}
                      tick={{ fill: isDarkMode ? '#f3f4f6' : '#374151', fontSize: 12 }}
                      axisLine={{ stroke: isDarkMode ? '#374151' : '#e5e7eb' }}
                      tickLine={false}
                      interval={0}
                    />
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke={isDarkMode ? 'rgba(148,163,184,0.35)' : '#e5e7eb'}
                      horizontal={false}
                      vertical
                    />
                    <Tooltip
                      cursor={{
                        fill: isDarkMode ? 'rgba(0,151,80,0.14)' : 'rgba(0,151,80,0.08)',
                      }}
                      contentStyle={{
                        backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                        border: isDarkMode ? '1px solid rgba(255,255,255,0.10)' : '1px solid #d1d5db',
                        borderRadius: '8px',
                        color: isDarkMode ? '#f9fafb' : '#1f2937',
                        boxShadow: isDarkMode ? '0 10px 25px rgba(15,23,42,0.35)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      }}
                      labelStyle={{ color: isDarkMode ? '#e5e7eb' : '#111827', fontSize: 11 }}
                      formatter={(value) => [value, 'Feedback']}
                      labelFormatter={(label) => String(label)}
                    />
                    <Bar dataKey="total" radius={[0, 8, 8, 0]} barSize={22} maxBarSize={28} fill={VIRIDIS.green} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Time-based Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sentiment Trend (Area Chart) */}
            <div className="card p-4 sm:p-6 xl:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{trendTitle}</h2>
                <span className="text-xs text-gray-500 dark:text-gray-400">Daily counts · GMT</span>
              </div>
              {analyticsLoading || !analyticsDelayPassed ? (
                <div className="w-full h-[320px] bg-gray-50 rounded-xl animate-pulse" />
              ) : (
                <div>
                  {trendAllZero && (
                    <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                      {trendEmptyMessage}
                    </p>
                  )}
                  <div
                    style={{ height: '320px' }}
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
                    className={onNavigateToInsights ? 'cursor-pointer' : undefined}
                    aria-label={onNavigateToInsights ? 'Open insights' : undefined}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={trendData}
                        margin={{ top: 10, right: 12, left: 4, bottom: 28 }}
                      >
                        <defs>
                          <linearGradient id="trendPositive" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={SENTIMENT_COLORS.Positive} stopOpacity={0.65} />
                            <stop offset="100%" stopColor={SENTIMENT_COLORS.Positive} stopOpacity={0.05} />
                          </linearGradient>
                          <linearGradient id="trendNeutral" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={SENTIMENT_COLORS.Neutral} stopOpacity={0.45} />
                            <stop offset="100%" stopColor={SENTIMENT_COLORS.Neutral} stopOpacity={0.05} />
                          </linearGradient>
                          <linearGradient id="trendNegative" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={SENTIMENT_COLORS.Negative} stopOpacity={0.55} />
                            <stop offset="100%" stopColor={SENTIMENT_COLORS.Negative} stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: '#6b7280', fontSize: 10 }}
                          axisLine={{ stroke: '#e5e7eb' }}
                          tickMargin={8}
                          interval="preserveStartEnd"
                          minTickGap={24}
                          tickFormatter={(v) => {
                            if (v == null || typeof v !== 'string') return v
                            const parts = v.split('-')
                            return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : v
                          }}
                        />
                        <YAxis
                          tick={{ fill: '#6b7280', fontSize: 11 }}
                          axisLine={{ stroke: '#e5e7eb' }}
                          allowDecimals={false}
                          domain={[0, trendYMax]}
                          width={36}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#111827',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '10px',
                            color: '#f9fafb',
                            boxShadow: '0 10px 25px rgba(15,23,42,0.25)',
                          }}
                          labelStyle={{ color: '#e5e7eb', fontSize: 11 }}
                          labelFormatter={(label) => (label ? String(label) : '')}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="positive"
                          name="Positive"
                          stroke={SENTIMENT_COLORS.Positive}
                          strokeWidth={2.2}
                          fill="url(#trendPositive)"
                          fillOpacity={trendAllZero ? 0.1 : 0.18}
                          connectNulls
                          activeDot={{ r: 4, strokeWidth: 0 }}
                          isAnimationActive={!trendAllZero}
                        />
                        <Area
                          type="monotone"
                          dataKey="neutral"
                          name="Neutral"
                          stroke={SENTIMENT_COLORS.Neutral}
                          strokeWidth={2}
                          fill="url(#trendNeutral)"
                          fillOpacity={trendAllZero ? 0.08 : 0.14}
                          connectNulls
                          activeDot={{ r: 4, strokeWidth: 0 }}
                          isAnimationActive={!trendAllZero}
                        />
                        <Area
                          type="monotone"
                          dataKey="negative"
                          name="Negative"
                          stroke={SENTIMENT_COLORS.Negative}
                          strokeWidth={2.1}
                          fill="url(#trendNegative)"
                          fillOpacity={trendAllZero ? 0.08 : 0.14}
                          connectNulls
                          activeDot={{ r: 4, strokeWidth: 0 }}
                          isAnimationActive={!trendAllZero}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

                    </div>
    </>
  )
}
