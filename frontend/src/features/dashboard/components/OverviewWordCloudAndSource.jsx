import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'
import { SENTIMENT_COLORS } from '../constants/palette'
import { getWordCloudUrl } from '../services/dashboard.api'
import { SourceAxisTick } from './SourceIndicators'

/**
 * Overview-only: word cloud and stacked source sentiment chart (layout respects role toggles).
 */
export default function OverviewWordCloudAndSource({
  showSourceChart,
  showWordCloudSection,
  sourceAndWordcloudSideBySide,
  analyticsLoading,
  analyticsDelayPassed,
  isDarkMode,
  sourcePerformance,
}) {
  if (!showSourceChart && !showWordCloudSection) return null

  return (
    <div
      className={
        sourceAndWordcloudSideBySide
          ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch'
          : 'grid grid-cols-1 gap-6'
      }
    >
      {showWordCloudSection && (
        <div className="card p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 sm:mb-6">Word Cloud</h2>
          {analyticsLoading ? (
            <div className="w-full h-64 sm:h-72 lg:h-[22rem] bg-gray-50 dark:bg-white/[0.04] rounded-xl animate-pulse" />
          ) : (
            <div className="bg-gray-50 dark:bg-gray-950/40 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden h-64 sm:h-72 lg:h-[22rem]">
              <img
                src={`${getWordCloudUrl()}?t=${Date.now()}`}
                alt="Word Cloud"
                className="w-full h-full object-contain"
                style={
                  isDarkMode
                    ? { filter: 'invert(1) hue-rotate(180deg) contrast(1.1) brightness(0.9)' }
                    : undefined
                }
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'flex'
                }}
              />
              <div
                className="hidden h-full w-full items-center justify-center text-gray-500 dark:text-gray-400 text-sm px-6 text-center"
                style={{ display: 'none' }}
              >
                Word cloud will appear when feedback data is available
              </div>
            </div>
          )}
        </div>
      )}

      {showSourceChart && (
        <div className="card p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Feedback Source</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            How each channel performs by volume and sentiment.
          </p>
          {analyticsLoading || !analyticsDelayPassed ? (
            <div className="w-full h-64 sm:h-72 lg:h-[22rem] bg-gray-50 dark:bg-white/[0.04] rounded-xl animate-pulse" />
          ) : (
            <div className="h-64 sm:h-72 lg:h-[22rem]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourcePerformance} layout="vertical" margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                  <XAxis
                    type="number"
                    tick={{ fill: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }}
                    axisLine={{ stroke: isDarkMode ? '#374151' : '#d1d5db' }}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="source"
                    tick={<SourceAxisTick />}
                    axisLine={{ stroke: isDarkMode ? '#374151' : '#d1d5db' }}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                      border: isDarkMode ? '1px solid #374151' : '1px solid #d1d5db',
                      borderRadius: '8px',
                      color: isDarkMode ? '#f9fafb' : '#1f2937',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="positive" stackId="sentiment" name="Positive" fill={SENTIMENT_COLORS.Positive} />
                  <Bar dataKey="neutral" stackId="sentiment" name="Neutral" fill={SENTIMENT_COLORS.Neutral} />
                  <Bar dataKey="negative" stackId="sentiment" name="Negative" fill={SENTIMENT_COLORS.Negative} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
