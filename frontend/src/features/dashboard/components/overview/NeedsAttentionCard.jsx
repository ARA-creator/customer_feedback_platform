import { useMemo } from 'react'
import { FiAlertTriangle, FiArrowRight, FiClock } from 'react-icons/fi'
import DashboardChartCard from './DashboardChartCard'
import { feedbackMetaLine } from './recentFeedbackUi'
import { humanizeSource } from '../../utils/insightsMetrics'
import {
  buildNeedsAttentionItems,
  formatAttentionAge,
} from '../../utils/needsAttention'

function ChartSkeleton({ className = 'h-56' }) {
  return <div className={`w-full rounded-xl bg-gray-100 animate-pulse dark:bg-white/[0.06] ${className}`} />
}

function ViewAllButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      {children}
    </button>
  )
}

function reasonPillClass(reason) {
  const r = String(reason || '').toLowerCase()
  if (r.includes('negative')) {
    return 'bg-rose-50 text-rose-800 ring-1 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900/40'
  }
  if (r.includes('high')) {
    return 'bg-amber-50 text-amber-900 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900/40'
  }
  if (r.includes('policy')) {
    return 'bg-[#009750]/10 text-[#007a42] ring-1 ring-[#009750]/20 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/40'
  }
  return 'bg-gray-50 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700'
}

function AttentionRow({ entry, onOpen }) {
  const item = entry.item
  const msg = String(item.message || item.summary || item.message_preview || '').trim()
  const preview = msg.length > 90 ? `${msg.slice(0, 90)}…` : msg || '—'
  const age = formatAttentionAge(item.created_at)
  const source = humanizeSource(item?.source)

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen?.(item)}
        className="w-full rounded-xl border border-gray-200 bg-white p-3.5 text-left transition-colors hover:border-rose-200 hover:bg-rose-50/40 dark:border-gray-700 dark:bg-gray-950 dark:hover:border-rose-900/50 dark:hover:bg-rose-950/20"
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200"
            aria-hidden
          >
            <FiAlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug text-gray-900 dark:text-gray-100">{preview}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
              <span>{source}</span>
              {age ? (
                <span className="inline-flex items-center gap-1">
                  <FiClock className="h-3 w-3" aria-hidden />
                  {age}
                </span>
              ) : null}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {entry.reasons.slice(0, 3).map((reason) => (
                <span
                  key={reason}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${reasonPillClass(reason)}`}
                >
                  {reason}
                </span>
              ))}
            </div>
            <p className="sr-only">{feedbackMetaLine(item)}</p>
          </div>
        </div>
      </button>
    </li>
  )
}

/**
 * Overview action queue: unreplied negative / high-priority / policy-review items.
 */
export default function NeedsAttentionCard({
  ready,
  listLoading = false,
  recentFeedback = [],
  priorityQueue = [],
  onViewAll,
  onOpenFeedback,
}) {
  const entries = useMemo(
    () => buildNeedsAttentionItems([recentFeedback, priorityQueue], { limit: 5 }),
    [recentFeedback, priorityQueue],
  )

  const showSkeleton = !ready || listLoading

  return (
    <DashboardChartCard
      title="Needs attention"
      subtitle="Unreplied items that need a next step"
      action={onViewAll ? <ViewAllButton onClick={onViewAll}>View in inbox</ViewAllButton> : null}
    >
      {showSkeleton ? (
        <ChartSkeleton className="h-56" />
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-4 py-6 text-center dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">You’re clear</p>
          <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">
            No unreplied negative, high-priority, or policy-review items in this set.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {entries.map((entry) => (
              <AttentionRow key={entry.item.id} entry={entry} onOpen={onOpenFeedback} />
            ))}
          </ul>
          {onViewAll ? (
            <button
              type="button"
              onClick={onViewAll}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              Open action queue
              <FiArrowRight className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </>
      )}
    </DashboardChartCard>
  )
}
