import { useMemo } from 'react'
import { FiArrowRight } from 'react-icons/fi'
import DashboardChartCard from './DashboardChartCard'
import {
  getSentimentIcon,
  itemMatchesSentimentFilter,
  sentimentAvatarRingClass,
  sentimentIconGlyphClass,
  sentimentLabelFromItem,
} from '../../../../shared/lib/sentimentDisplay'
import {
  categoryPillClass,
  feedbackCategoryLabel,
  feedbackMetaLine,
} from './recentFeedbackUi'

function ChartSkeleton({ className = 'h-56' }) {
  return <div className={`w-full rounded-xl bg-gray-100 animate-pulse dark:bg-white/[0.06] ${className}`} />
}

function ViewAllButton({ onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 ${className}`}
    >
      {children}
    </button>
  )
}

function FeedbackRow({ item, onOpen }) {
  const msg = String(item.message || item.summary || '').trim()
  const preview = msg.length > 85 ? `${msg.slice(0, 85)}…` : msg || '—'
  const tagLabel = feedbackCategoryLabel(item)
  const sentiment = sentimentLabelFromItem(item) || 'neutral'
  const SentimentIcon = getSentimentIcon(sentiment)

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen?.(item)}
        className="w-full rounded-xl border border-gray-200 bg-white p-3.5 text-left transition-colors hover:border-gray-300 hover:bg-gray-50/80 dark:border-gray-700 dark:bg-gray-950 dark:hover:border-gray-600 dark:hover:bg-gray-900/80"
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${sentimentAvatarRingClass(sentiment)}`}
            aria-hidden
          >
            <SentimentIcon
              className={`h-5 w-5 ${sentimentIconGlyphClass(sentiment)}`}
              aria-hidden
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug text-gray-900 dark:text-gray-100">{preview}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{feedbackMetaLine(item)}</p>
          </div>
          <span
            className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold ${categoryPillClass(item.category)}`}
          >
            {tagLabel}
          </span>
        </div>
      </button>
    </li>
  )
}

export default function RecentFeedbackCard({
  ready,
  listLoading = false,
  recentFeedback = [],
  sentimentFilter = 'all',
  onViewAll,
  onViewAllFeedback,
  onOpenFeedback,
}) {
  const recent = useMemo(() => {
    const list = Array.isArray(recentFeedback) ? recentFeedback : []
    return list.filter((it) => itemMatchesSentimentFilter(it, sentimentFilter)).slice(0, 3)
  }, [recentFeedback, sentimentFilter])

  const showSkeleton = !ready || listLoading

  const emptyLabel = useMemo(() => {
    const f = String(sentimentFilter || 'all').toLowerCase()
    if (f && f !== 'all') {
      return `No ${f} feedback in this period.`
    }
    return 'No recent feedback yet.'
  }, [sentimentFilter])

  const showFooter = Boolean(onViewAllFeedback && recent.length > 0)

  return (
    <DashboardChartCard
      title="Recent Feedback"
      action={onViewAll ? <ViewAllButton onClick={onViewAll}>View all</ViewAllButton> : null}
    >
      {showSkeleton ? (
        <ChartSkeleton className="h-56" />
      ) : recent.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">{emptyLabel}</p>
      ) : (
        <>
          <ul className="space-y-3">
            {recent.map((item) => (
              <FeedbackRow key={item.id} item={item} onOpen={onOpenFeedback} />
            ))}
          </ul>
          {showFooter && (
            <button
              type="button"
              onClick={onViewAllFeedback}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              View all feedback
              <FiArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </>
      )}
    </DashboardChartCard>
  )
}
