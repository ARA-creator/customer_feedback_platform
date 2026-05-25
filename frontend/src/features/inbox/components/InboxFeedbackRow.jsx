import { FiArchive } from 'react-icons/fi'
import { extractFeedbackTitle, getPriorityBadge } from '../utils/inboxDerivedStats'

const SENTIMENT_EMOJI = {
  positive: '😊',
  negative: '😞',
  neutral: '😐',
}

const PRIORITY_STYLES = {
  new: 'border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  medium: 'border-blue-200/80 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200',
  high: 'border-rose-200/80 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
}

const SENTIMENT_STYLES = {
  positive: 'border-emerald-200/70 bg-emerald-50/90 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200',
  negative: 'border-rose-200/70 bg-rose-50/90 text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200',
  neutral: 'border-amber-200/70 bg-amber-50/90 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100',
}

function formatSourceLabel(source) {
  const s = String(source || 'source').replace(/_/g, ' ')
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatThemeLabel(tag) {
  return String(tag || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function InboxFeedbackRow({
  item,
  active,
  selected,
  isArchived,
  onSelect,
  onToggleSelect,
  onArchiveToggle,
  formatRelativeTime,
  SourceIcon,
}) {
  const sentiment = String(item?.sentiment_label || 'unknown').toLowerCase()
  const emoji = SENTIMENT_EMOJI[sentiment] || '😐'
  const title = extractFeedbackTitle(item)
  const preview = String(item?.message || item?.message_preview || '').trim()
  const snippet =
    preview.length > title.length + 10
      ? preview.slice(title.length).trim().slice(0, 120) || preview.slice(0, 120)
      : preview.slice(0, 120)
  const priority = getPriorityBadge(item)
  const tags = Array.isArray(item?.insurance_tags)
    ? item.insurance_tags
    : Array.isArray(item?.channel_metadata?.insurance_tags)
      ? item.channel_metadata.insurance_tags
      : []

  return (
    <div
      data-feedback-id={item.id}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect?.()
      }}
      className={`group relative flex gap-3 rounded-xl border bg-white px-3 py-3.5 shadow-sm transition-all hover:bg-gray-50/90 dark:bg-gray-950 dark:hover:bg-gray-900/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750]/40 ${
        active
          ? 'border-gray-200 border-l-4 border-l-[#10B981] pl-2 dark:border-gray-700'
          : 'border-gray-200 dark:border-gray-700'
      }`}
      aria-current={active ? 'true' : undefined}
    >
      <label
        className="flex shrink-0 items-start pt-1"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="h-4 w-4 rounded border-gray-300 text-[#009750] focus:ring-[#009750]/40"
          aria-label={`Select feedback ${item.id}`}
        />
      </label>

      <span className="flex h-10 w-10 shrink-0 items-center justify-center text-2xl" aria-hidden>
        {emoji}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100 line-clamp-1 pr-2">
            {title}
          </p>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${SENTIMENT_STYLES[sentiment] || SENTIMENT_STYLES.neutral}`}
              >
                {sentiment}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLES[priority.tone]}`}
              >
                {priority.label}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onArchiveToggle?.()
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              title={isArchived ? 'Unarchive' : 'Archive'}
              aria-label={isArchived ? 'Unarchive' : 'Archive'}
            >
              <FiArchive className="h-4 w-4" />
            </button>
          </div>
        </div>

        {snippet ? (
          <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400 line-clamp-2">{snippet}</p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            {SourceIcon ? <SourceIcon source={item.source_group || item.source} /> : null}
            {formatSourceLabel(item.source_group || item.source)}
          </span>
          {tags.slice(0, 2).map((t) => (
            <span
              key={`${item.id}-${t}`}
              className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
              {formatThemeLabel(t)}
            </span>
          ))}
          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
            {item.created_at ? formatRelativeTime(item.created_at) : ''}
          </span>
        </div>
      </div>
    </div>
  )
}
