import { FiArchive, FiCheck, FiPlus, FiTrash2 } from 'react-icons/fi'

export default function InboxBulkBar({
  selectedCount,
  onMarkRead,
  onArchive,
  onClearSelection,
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 sm:px-6 lg:px-8">
      <div className="pointer-events-auto flex w-full max-w-5xl flex-wrap items-center gap-2 rounded-2xl border border-gray-200/90 bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur-md dark:border-gray-700 dark:bg-gray-950/95">
        <span className="mr-1 shrink-0 text-xs font-semibold tabular-nums text-gray-600 dark:text-gray-300">
          {selectedCount} selected
        </span>
        <button
          type="button"
          onClick={onMarkRead}
          disabled={selectedCount === 0}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <FiCheck className="h-3.5 w-3.5" aria-hidden />
          Mark as read
        </button>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="inline-flex min-h-[36px] items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-400 dark:border-gray-700 dark:bg-gray-900"
        >
          Change priority
        </button>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="inline-flex min-h-[36px] items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-400 dark:border-gray-700 dark:bg-gray-900"
        >
          Assign
        </button>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="inline-flex min-h-[36px] items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-400 dark:border-gray-700 dark:bg-gray-900"
        >
          Add tag
        </button>
        <button
          type="button"
          onClick={onArchive}
          disabled={selectedCount === 0}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <FiArchive className="h-3.5 w-3.5" aria-hidden />
          Archive
        </button>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 opacity-60 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
        >
          <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
          Delete
        </button>
        {selectedCount > 0 ? (
          <button
            type="button"
            onClick={onClearSelection}
            className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Clear
          </button>
        ) : null}
        <button
          type="button"
          disabled
          title="Import or connect a channel to add feedback"
          className="ml-auto inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#10B981] px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-70"
        >
          <FiPlus className="h-4 w-4" aria-hidden />
          New feedback
        </button>
      </div>
    </div>
  )
}
