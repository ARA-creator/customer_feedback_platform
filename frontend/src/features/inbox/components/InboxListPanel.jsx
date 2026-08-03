import { FiBookmark, FiCheck, FiChevronDown, FiInbox, FiMail, FiSend } from 'react-icons/fi'
import { EmptyState, InboxListSkeleton } from '../../../shared/components/ui'
import InboxFeedbackRow from './InboxFeedbackRow'
import { normFeedbackId } from '../hooks/useInboxUserState'

function CountBadge({ count, active }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
        active ? 'bg-white/20 text-white' : 'bg-[#009750] text-white'
      }`}
    >
      {Number.isFinite(count) ? count : 0}
    </span>
  )
}

export default function InboxListPanel({
  loading,
  error,
  listTab,
  onListTabChange,
  allCount,
  readCount,
  unreadCount,
  repliedCount = 0,
  sortBy,
  onSortChange,
  displayedItems,
  listHighlightId,
  loadingMore = false,
  selectedIds,
  selectedCount = 0,
  readIds,
  pinnedIds,
  archivedIds,
  allDisplayedSelected = false,
  onToggleSelectAll,
  onClearSelection,
  onMarkSelectedRead,
  onMarkSelectedUnread,
  onPinSelected,
  onUnpinSelected,
  onOpenItem,
  onToggleSelected,
  onTogglePinned,
  onArchiveToggle,
  onToggleReplied,
  formatRelativeTime,
  SourceIcon,
  hasMoreToShow,
  loadMoreSentinelRef,
  onLoadMore,
  onClearFilters,
  prefetchingList = false,
  highlightTheme = 'all',
}) {
  const showListControls = !loading && !error && displayedItems.length > 0

  const listTabs = [
    { key: 'all', label: 'All feedback', Icon: FiInbox, count: allCount },
    { key: 'read', label: 'Read', Icon: FiCheck, count: readCount },
    { key: 'unread', label: 'Unread', Icon: FiMail, count: unreadCount },
    { key: 'replied', label: 'Replied', Icon: FiSend, count: repliedCount },
  ]

  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3 dark:border-gray-800">
        <div
          className="inline-flex max-w-full flex-wrap shrink-0 rounded-full border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900"
          role="tablist"
          aria-label="Inbox list tabs"
        >
          {listTabs.map(({ key, label, Icon, count }) => {
            const active = listTab === key
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onListTabChange?.(key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#009750]/40 ${
                  active
                    ? 'bg-[#009750] text-white'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{label}</span>
                <CountBadge count={count} active={active} />
              </button>
            )
          })}
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

      {showListControls ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3 dark:border-gray-800/80">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-[#009750] focus:ring-[#009750]/30"
              checked={allDisplayedSelected}
              onChange={onToggleSelectAll}
              aria-label="Select all feedback on this page"
            />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Select all</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">({displayedItems.length})</span>
          </label>
          {selectedCount > 0 ? (
            <>
              <span className="hidden h-4 w-px bg-gray-200 sm:inline dark:bg-gray-700" aria-hidden />
              <button
                type="button"
                onClick={onMarkSelectedRead}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                title="Mark selected as read"
              >
                <FiCheck className="h-3.5 w-3.5" aria-hidden />
                Read
              </button>
              <button
                type="button"
                onClick={onMarkSelectedUnread}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                title="Mark selected as unread"
              >
                <FiMail className="h-3.5 w-3.5" aria-hidden />
                Unread
              </button>
              <button
                type="button"
                onClick={onPinSelected}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                title="Pin selected"
              >
                <FiBookmark className="h-3.5 w-3.5" aria-hidden />
                Pin
              </button>
              <button
                type="button"
                onClick={onUnpinSelected}
                className="inline-flex min-h-[36px] items-center rounded-lg border border-transparent px-2 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                title="Unpin selected"
              >
                Unpin
              </button>
              <button
                type="button"
                onClick={onClearSelection}
                className="inline-flex min-h-[36px] items-center rounded-lg border border-transparent px-2 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Clear ({selectedCount})
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {loading || prefetchingList ? (
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
            {displayedItems.map((it) => {
              const fid = normFeedbackId(it?.id)
              const isUnread = fid != null && !readIds?.has?.(fid)
              const isPinned = fid != null && pinnedIds?.has?.(fid)
              return (
                <InboxFeedbackRow
                  key={it.id}
                  item={it}
                  active={listHighlightId === it.id}
                  selected={fid != null && selectedIds.has(fid)}
                  isUnread={isUnread}
                  isPinned={isPinned}
                  isArchived={archivedIds.has(it.id)}
                  highlightTheme={highlightTheme}
                  onSelect={() => onOpenItem?.(it)}
                  onToggleSelect={() => onToggleSelected?.(it.id)}
                  onTogglePinned={() => onTogglePinned?.(it.id)}
                  onArchiveToggle={() => onArchiveToggle?.(it.id)}
                  onToggleReplied={() => onToggleReplied?.(it.id)}
                  formatRelativeTime={formatRelativeTime}
                  SourceIcon={SourceIcon}
                />
              )
            })}
            {(hasMoreToShow || loadingMore) && (
              <>
                <div ref={loadMoreSentinelRef} className="h-2 w-full" aria-hidden />
                <div className="flex justify-center pt-2 pb-2">
                  <button
                    type="button"
                    onClick={onLoadMore}
                    disabled={loadingMore}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-[#009750] shadow-sm hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900"
                  >
                    {loadingMore ? 'Loading…' : 'Load more feedback'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
