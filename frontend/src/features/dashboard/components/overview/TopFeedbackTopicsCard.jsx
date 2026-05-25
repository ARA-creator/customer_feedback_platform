import { FiArrowRight } from 'react-icons/fi'
import { SENTIMENT_COLORS } from '../../constants/palette'
import DashboardChartCard from './DashboardChartCard'

function ChartSkeleton({ className = 'h-56' }) {
  return <div className={`w-full rounded-xl bg-gray-100 animate-pulse dark:bg-white/[0.06] ${className}`} />
}

function SentimentMixBar({ negPct, posPct }) {
  const neg = Math.max(0, Math.min(100, negPct))
  const pos = Math.max(0, Math.min(100 - neg, posPct))

  return (
    <div
      className="flex h-2.5 w-full min-w-[7rem] overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
      role="img"
      aria-label={`Sentiment mix: ${Math.round(neg)}% negative, ${Math.round(pos)}% positive`}
    >
      {neg > 0 ? (
        <span
          className="h-full shrink-0 rounded-l-full"
          style={{ width: `${neg}%`, backgroundColor: SENTIMENT_COLORS.Negative }}
        />
      ) : null}
      {pos > 0 ? (
        <span
          className={`h-full shrink-0 ${neg <= 0 ? 'rounded-l-full' : ''} ${neg + pos >= 99.5 ? 'rounded-r-full' : ''}`}
          style={{ width: `${pos}%`, backgroundColor: SENTIMENT_COLORS.Positive }}
        />
      ) : null}
    </div>
  )
}

function TopicRow({ row }) {
  return (
    <tr>
      <td className="py-3 pr-3 text-sm font-medium text-gray-900 dark:text-gray-100">{row.name}</td>
      <td className="py-3 pr-3">
        <SentimentMixBar negPct={row.negPct} posPct={row.posPct} />
      </td>
      <td className="py-3 text-right text-sm tabular-nums font-medium text-gray-800 dark:text-gray-200">
        {row.total}
      </td>
    </tr>
  )
}

export default function TopFeedbackTopicsCard({ ready, topics = [], onViewAllTopics }) {
  const rows = (Array.isArray(topics) ? topics : []).slice(0, 5)
  const showFooter = Boolean(onViewAllTopics && rows.length > 0)

  return (
    <DashboardChartCard title="Top Feedback Topics">
      {!ready ? (
        <ChartSkeleton className="h-56" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">No tagged themes in this period.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left">
              <colgroup>
                <col className="w-[38%]" />
                <col className="w-[42%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead>
                <tr className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  <th className="pb-2 pr-3 font-medium">Topic</th>
                  <th className="pb-2 pr-3 font-medium">Sentiment</th>
                  <th className="pb-2 text-right font-medium">Volume</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <TopicRow key={row.key} row={row} />
                ))}
              </tbody>
            </table>
          </div>
          {showFooter && (
            <button
              type="button"
              onClick={onViewAllTopics}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              View all topics
              <FiArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </>
      )}
    </DashboardChartCard>
  )
}
