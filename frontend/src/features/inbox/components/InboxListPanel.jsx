import { FiChevronDown } from 'react-icons/fi'
import { EmptyState, InboxListSkeleton } from '../../../shared/components/ui'
import { FiInbox } from 'react-icons/fi'
import InboxFeedbackRow from './InboxFeedbackRow'

export default function InboxListPanel({
  loading,
  error,
  listTab,
  onListTabChange,
  allCount,
  unreadCount,
  sortBy,
  onSortChange,
  displayedItems,
  visibleCount,
  listHighlightId,
  selectedIds,
  readIds,
  archivedIds,
  onOpenItem,
  onToggleSelected,
  onArchiveToggle,
  formatRelativeTime,
  SourceIcon,
  hasMoreToShow,
  loadMoreSentinelRef,
  onLoadMore,
  onClearFilters,
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3 dark:border-gray-800">
        <div className="flex items-center gap-4" role="tablist" aria-label="Inbox list tabs">
          <button
            type="button"
            role="tab"
            aria-selected={listTab === 'unread'}
            onClick={() => onListTabChange?.('unread')}
            className={`relative pb-2 text-sm font-semibold transition-colors ${
              listTab === 'unread'
                ? 'text-[#10B981] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-[#10B981]'
                : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Unread
            {unreadCount > 0 ? (
              <span className="ml-1.5 text-xs font-bold text-gray-400">{unreadCount}</span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={listTab === 'all'}
            onClick={() => onListTabChange?.('all')}
            className={`relative pb-2 text-sm font-semibold transition-colors ${
              listTab === 'all'
                ? 'text-[#10B981] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-[#10B981]'
                : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            All feedback ({allCount})
          </button>
        </div>

        <div className="relative">
          <label className="sr-only" htmlFor="inbox-sort">
            Sort feedback
          </label>
          <select
            id="inbox-sort"
            value={sortBy}
            onChange={(e) => onSortChange?.(e.target.value)}
            className="inline-flex min-h-[36px] appearance-none items-center gap-2 rounded-lg border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-xs font-semibold text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="newest">Sort: Newest first</option>
            <option value="oldest">Sort: Oldest first</option>
            <option value="priority">Sort: Priority</option>
          </select>
          <FiChevronDown
            className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {loading ? (
          <InboxListSkeleton rows={5} />
        ) : error ? null : displayedItems.length === 0 ? (
          <EmptyState
            icon={FiInbox}
            title="No feedback matches these filters"
            description="Try widening filters or switch to All feedback."
            primaryAction={{
              label: 'Show all feedback',
              onClick: () => {
                onListTabChange?.('all')
                onClearFilters?.()
              },
            }}
          />
        ) : (
          <>
            {displayedItems.map((it) => (
              <InboxFeedbackRow
                key={it.id}
                item={it}
                active={listHighlightId === it.id}
                selected={selectedIds.has(it.id)}
                isArchived={archivedIds.has(it.id)}
                onSelect={() => onOpenItem?.(it)}
                onToggleSelect={() => onToggleSelected?.(it.id)}
                onArchiveToggle={() => onArchiveToggle?.(it.id)}
                formatRelativeTime={formatRelativeTime}
                SourceIcon={SourceIcon}
              />
            ))}
            {hasMoreToShow && (
              <>
                <div ref={loadMoreSentinelRef} className="h-2 w-full" aria-hidden />
                <div className="flex justify-center pt-2 pb-2">
                  <button
                    type="button"
                    onClick={onLoadMore}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-[#009750] shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
                  >
                    Load more feedback
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {!loading && !error && displayedItems.length > 0 && visibleCount > displayedItems.length ? (
        <p className="mt-2 text-center text-xs text-gray-400">
          Showing {displayedItems.length} of {visibleCount}
        </p>
      ) : null}
    </div>
  )
}
