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
import { VIRIDIS, SENTIMENT_COLORS, CHART_PALETTE } from '../constants/palette'
import { getPeakHeatmapCellStyles } from '../utils/dashboardRole'

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
  productPulseTrendPivot,
  categoryTrendPivot,
  insuranceTagsBreakdown,
  sourceTrends,
  sourceTrendColors,
  peakTimes,
  peakTimesTotalCount,
  peakTimesMaxCount,
  heatmapHover,
  setHeatmapHover,
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onNavigateBack?.()}
          className="inline-flex items-center justify-center h-11 w-11 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#009750]/40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          aria-label="Back to overview"
        >
          <FiArrowLeft className="w-5 h-5" aria-hidden />
        </button>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-tight">Insights</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Filter by product name to focus charts on one plan; all charts use the same range and product scope.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="insights-product-filter" className="sr-only">
              Filter by product name
            </label>
            <select
              id="insights-product-filter"
              value={insightsProductKey}
              onChange={(e) => setInsightsProductKey(e.target.value)}
              className="min-h-[40px] max-w-[min(100vw-2rem,20rem)] rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              aria-label="Filter insights by product name"
            >
              <option value="">All products</option>
              {insightsProductOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div
            className="inline-flex rounded-full border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900"
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
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#009750]/40 ${
                    active
                      ? 'bg-[#009750] text-white'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800'
                  }`}
                  aria-pressed={active}
                >
                  {d}d
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="card p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Product pulse over time (Last {insightsRange} Days)
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Daily feedback volume for your top products (from primary product/policy detection). Aligns with the 7d / 30d
          / 90d filter above.
        </p>
        {analyticsLoading || !analyticsDelayPassed ? (
          <div className="w-full h-64 sm:h-72 bg-gray-50 dark:bg-gray-900/40 rounded-xl animate-pulse" />
        ) : productPulseTrendPivot.products.length === 0 || productPulseTrendPivot.data.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            No product matches in this window yet. When feedback includes a detected primary product or policy, trends
            appear here.
          </p>
        ) : (
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={productPulseTrendPivot.data}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: isDarkMode ? '#d1d5db' : '#6b7280', fontSize: 11 }}
                  axisLine={{ stroke: isDarkMode ? '#374151' : '#d1d5db' }}
                  tickFormatter={(v) => {
                    if (v == null || typeof v !== 'string') return v
                    const parts = v.split('-')
                    return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : v
                  }}
                />
                <YAxis
                  tick={{ fill: isDarkMode ? '#d1d5db' : '#6b7280', fontSize: 11 }}
                  axisLine={{ stroke: isDarkMode ? '#374151' : '#d1d5db' }}
                  allowDecimals={false}
                />
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDarkMode ? '#1f2937' : '#e5e7eb'}
                  vertical={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                    border: `1px solid ${isDarkMode ? '#374151' : '#d1d5db'}`,
                    borderRadius: '8px',
                    color: isDarkMode ? '#f9fafb' : '#1f2937',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  labelStyle={{ color: isDarkMode ? '#f9fafb' : '#111827' }}
                />
                <Legend />
                {productPulseTrendPivot.products.map((prod, idx) => (
                  <Line
                    key={prod}
                    type="monotone"
                    dataKey={prod}
                    name={prod}
                    stroke={CHART_PALETTE[idx % CHART_PALETTE.length] || VIRIDIS.green}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Category Trends (Last {insightsRange} Days)
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            How frequently each category appears over time. Focus on your top issue types.
          </p>
          {analyticsLoading || !analyticsDelayPassed ? (
            <div className="w-full h-56 sm:h-64 bg-gray-50 dark:bg-gray-900/40 rounded-xl animate-pulse" />
          ) : (
            <div className="h-56 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={categoryTrendPivot.data}>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: isDarkMode ? '#d1d5db' : '#6b7280', fontSize: 11 }}
                    axisLine={{ stroke: isDarkMode ? '#374151' : '#d1d5db' }}
                  />
                  <YAxis
                    tick={{ fill: isDarkMode ? '#d1d5db' : '#6b7280', fontSize: 11 }}
                    axisLine={{ stroke: isDarkMode ? '#374151' : '#d1d5db' }}
                    allowDecimals={false}
                  />
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDarkMode ? '#1f2937' : '#e5e7eb'}
                    vertical={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                      border: `1px solid ${isDarkMode ? '#374151' : '#d1d5db'}`,
                      borderRadius: '8px',
                      color: isDarkMode ? '#f9fafb' : '#1f2937',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                    labelStyle={{ color: isDarkMode ? '#f9fafb' : '#111827' }}
                  />
                  <Legend />
                  {categoryTrendPivot.categories.length === 0 ? (
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="Count"
                      stroke={SENTIMENT_COLORS.Positive}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ) : (
                    categoryTrendPivot.categories.map((cat, idx) => (
                      <Line
                        key={cat}
                        type="monotone"
                        dataKey={cat}
                        name={cat}
                        stroke={CHART_PALETTE[idx % CHART_PALETTE.length] || SENTIMENT_COLORS.Positive}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        connectNulls
                      />
                    ))
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Insurance Categories (Last {insightsRange} Days)
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Rule-based tags: one primary theme per feedback (first ranked tag) so bar totals in this range add up to
            feedback count for the same window.
          </p>
          {analyticsLoading || !analyticsDelayPassed ? (
            <div className="w-full h-56 sm:h-64 bg-gray-50 dark:bg-gray-900/40 rounded-xl animate-pulse" />
          ) : (
            <div className="h-56 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={Object.entries(insuranceTagsBreakdown || {})
                    .map(([k, v]) => ({
                      tag: k,
                      count: Number(v?.total ?? 0),
                    }))
                    .filter((r) => r.count > 0)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10)
                    .map((row, idx) => ({ ...row, fill: CHART_PALETTE[idx % CHART_PALETTE.length] }))}
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                >
                  <XAxis
                    dataKey="tag"
                    tick={{ fill: isDarkMode ? '#d1d5db' : '#6b7280', fontSize: 11 }}
                    axisLine={{ stroke: isDarkMode ? '#374151' : '#d1d5db' }}
                    tickLine={{ stroke: isDarkMode ? '#374151' : '#d1d5db' }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={58}
                  />
                  <YAxis
                    tick={{ fill: isDarkMode ? '#d1d5db' : '#6b7280', fontSize: 11 }}
                    axisLine={{ stroke: isDarkMode ? '#374151' : '#d1d5db' }}
                    allowDecimals={false}
                  />
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDarkMode ? '#1f2937' : '#e5e7eb'}
                    vertical={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                      border: `1px solid ${isDarkMode ? '#374151' : '#d1d5db'}`,
                      borderRadius: '8px',
                      color: isDarkMode ? '#f9fafb' : '#1f2937',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                    labelStyle={{ color: isDarkMode ? '#f9fafb' : '#111827' }}
                    formatter={(value) => [value, 'Count']}
                  />
                  <Bar dataKey="count" name="Count">
                    {Object.entries(insuranceTagsBreakdown || {})
                      .map(([k, v]) => ({ tag: k, count: Number(v?.total ?? 0) }))
                      .filter((r) => r.count > 0)
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 10)
                      .map((row, idx) => (
                        <Cell key={`ins-${row.tag}`} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                      ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Source Trend (Last {insightsRange} Days)
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Daily feedback volume by top channels (remaining channels grouped as “other”).
          </p>
          {analyticsLoading || !analyticsDelayPassed ? (
            <div className="w-full h-56 sm:h-64 bg-gray-50 dark:bg-gray-900/40 rounded-xl animate-pulse" />
          ) : (
            <div className="h-56 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sourceTrends?.data || []}>
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={{ stroke: '#d1d5db' }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={{ stroke: '#d1d5db' }} allowDecimals={false} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      color: '#1f2937',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Legend />
                  {(Array.isArray(sourceTrends?.sources) ? sourceTrends.sources : []).map((src) => {
                    const key = String(src || '')
                    if (!key) return null
                    return (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        name={key === 'google_forms' ? 'Google Forms' : key.replace(/_/g, ' ')}
                        stroke={sourceTrendColors[key] || '#6b7280'}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card p-4 sm:p-6 lg:col-span-2">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Peak Feedback Times (Last {insightsRange} Days)
            </h2>
          </div>
          {analyticsLoading ? (
            <div className="w-full h-56 sm:h-64 bg-gray-50 dark:bg-gray-900/40 rounded-xl animate-pulse" />
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Counts of feedback by day of week and hour (UTC). Color shows sentiment (greener when more positive than
                negative, redder when more negative); intensity reflects volume.
              </p>
              {peakTimesTotalCount === 0 && (
                <p className="mb-3 text-xs text-gray-500">No peak-time data yet. Add more feedback and refresh.</p>
              )}
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <div className="inline-flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                  <span className="font-semibold shrink-0">More negative</span>
                  <span
                    className="h-2.5 w-28 rounded-full border border-gray-200 dark:border-gray-700"
                    style={{
                      background: `linear-gradient(90deg, hsl(0, 72%, ${isDarkMode ? 38 : 52}%) 0%, hsl(60, 55%, ${
                        isDarkMode ? 42 : 58
                      }%) 50%, hsl(120, 65%, ${isDarkMode ? 36 : 48}%) 100%)`,
                    }}
                  />
                  <span className="font-semibold shrink-0">More positive</span>
                </div>
                {heatmapHover?.count != null ? (
                  <div className="text-[11px] text-gray-600 dark:text-gray-300">
                    <span className="font-semibold">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][heatmapHover?.dow] || ''}
                    </span>
                    <span className="font-medium">
                      {' '}
                      · {String(heatmapHover?.hour).padStart(2, '0')}:00–
                      {String((heatmapHover?.hour + 1) % 24).padStart(2, '0')}:00
                    </span>
                    <span className="font-medium"> · {heatmapHover.count} total</span>
                    <span className="font-medium">
                      {' '}
                      · {heatmapHover.pos ?? 0} positive · {heatmapHover.neg ?? 0} negative · {heatmapHover.neu ?? 0}{' '}
                      neutral
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">Hover a cell to see details.</div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-left text-gray-500 dark:text-gray-400 font-medium">Hour</th>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                        <th key={label} className="px-2 py-1 text-center text-gray-500 dark:text-gray-400 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 24 }).map((_, hour) => (
                      <tr key={hour} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-2 py-1 text-gray-500 dark:text-gray-400">{String(hour).padStart(2, '0')}:00</td>
                        {Array.from({ length: 7 }).map((__, dow) => {
                          const cell = peakTimes.find((pt) => pt.day_of_week === dow && pt.hour === hour)
                          const count = cell?.count || 0
                          const pos = cell?.positive || 0
                          const neg = cell?.negative || 0
                          const neu = cell?.neutral || 0
                          const hm = getPeakHeatmapCellStyles(pos, neg, count, peakTimesMaxCount, isDarkMode)
                          const canClick = count > 0
                          return (
                            <td
                              key={dow}
                              className={`px-2 py-1 text-center align-middle ${hm.classBg} ${hm.textClass} rounded-sm ${
                                canClick
                                  ? 'cursor-pointer hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#009750]/40'
                                  : ''
                              }`}
                              style={hm.style}
                              title={`${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dow]} ${String(hour).padStart(
                                2,
                                '0',
                              )}:00 · ${count} total · ${pos} positive · ${neg} negative · ${neu} neutral`}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
