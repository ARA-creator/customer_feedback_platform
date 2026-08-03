import { FiArchive, FiBookmark, FiMail } from 'react-icons/fi'
import {
  getSentimentIcon,
  sentimentAvatarRingClass,
  sentimentIconGlyphClass,
  sentimentLabelFromItem,
} from '../../../shared/lib/sentimentDisplay'
import { getPolicySummary, policyHolderBadge } from '../../../shared/utils/policyMatch'
import { extractFeedbackTitle, getPriorityBadge } from '../utils/inboxDerivedStats'

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

/** Prefer the active theme filter so multi-tagged items still show why they matched. */
function orderTagsForDisplay(tags, highlightTheme, limit = 3) {
  const list = (Array.isArray(tags) ? tags : [])
    .map((t) => String(t || '').trim())
    .filter(Boolean)
  const needle = String(highlightTheme || '').trim().toLowerCase()
  if (!needle || needle === 'all') return list.slice(0, limit)
  const matched = []
  const rest = []
  for (const t of list) {
    if (t.toLowerCase() === needle) matched.push(t)
    else rest.push(t)
  }
  return [...matched, ...rest].slice(0, limit)
}

export default function InboxFeedbackRow({
  item,
  active,
  selected,
  isUnread = true,
  isPinned = false,
  isArchived,
  highlightTheme = 'all',
  onSelect,
  onToggleSelect,
  onTogglePinned,
  onArchiveToggle,
  onToggleReplied,
  formatRelativeTime,
  SourceIcon,
}) {
  const sentiment = sentimentLabelFromItem(item) || 'neutral'
  const SentimentIcon = getSentimentIcon(sentiment)
  const title = extractFeedbackTitle(item)
  const preview = String(item?.message || item?.message_preview || '').trim()
  const snippet =
    preview.length > title.length + 10
      ? preview.slice(title.length).trim().slice(0, 120) || preview.slice(0, 120)
      : preview.slice(0, 120)
  const priority = getPriorityBadge(item)
  const rawTags = Array.isArray(item?.insurance_tags)
    ? item.insurance_tags
    : Array.isArray(item?.channel_metadata?.insurance_tags)
      ? item.channel_metadata.insurance_tags
      : []
  const tags = orderTagsForDisplay(rawTags, highlightTheme)
  const activeThemeKey = String(highlightTheme || '').trim().toLowerCase()
  const policySummary = getPolicySummary(item)
  const holderBadge = policyHolderBadge(item)

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
          : isUnread
            ? 'border-gray-200 dark:border-gray-700'
            : 'border-gray-200/80 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/30'
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

      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${sentimentAvatarRingClass(sentiment)}`}
        aria-hidden
      >
        <SentimentIcon className={`h-5 w-5 ${sentimentIconGlyphClass(sentiment)}`} aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={`min-w-0 flex-1 text-sm leading-snug line-clamp-1 pr-2 ${
              isUnread ? 'font-semibold text-gray-900 dark:text-gray-100' : 'font-medium text-gray-700 dark:text-gray-300'
            }`}
          >
            {isPinned ? (
              <FiBookmark className="mr-1 inline h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Pinned" />
            ) : null}
            {title}
          </p>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {isUnread ? (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-[#10B981]"
                title="Unread"
                aria-label="Unread"
              />
            ) : null}
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
            {item?.replied_at ? (
              <span
                className="rounded-full border border-sky-200/80 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
                title="Officer reply detected"
              >
                Replied
              </span>
            ) : null}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onTogglePinned?.()
              }}
              className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border transition-colors ${
                isPinned
                  ? 'border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                  : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
              }`}
              title={isPinned ? 'Unpin' : 'Pin'}
              aria-label={isPinned ? 'Unpin feedback' : 'Pin feedback'}
            >
              <FiBookmark className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleReplied?.()
              }}
              className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border transition-colors ${
                item?.replied_at
                  ? 'border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200'
                  : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
              }`}
              title={item?.replied_at ? 'Move back to Inbox' : 'Mark as replied'}
              aria-label={item?.replied_at ? 'Move back to Inbox' : 'Mark as replied'}
            >
              <FiMail className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onArchiveToggle?.()
              }}
              className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border transition-colors ${
                isArchived
                  ? 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
              }`}
              title={isArchived ? 'Unarchive' : 'Archive'}
              aria-label={isArchived ? 'Unarchive' : 'Archive'}
            >
              <FiArchive className="h-3.5 w-3.5" aria-hidden />
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
          {tags.map((t) => {
            const isMatch = activeThemeKey && activeThemeKey !== 'all' && String(t).toLowerCase() === activeThemeKey
            return (
              <span
                key={`${item.id}-${t}`}
                className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                  isMatch
                    ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                    : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                }`}
                title={isMatch ? 'Matched theme filter' : undefined}
              >
                {formatThemeLabel(t)}
              </span>
            )
          })}
          {holderBadge ? (
            <span
              className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${holderBadge.className}`}
              title={holderBadge.title}
            >
              {holderBadge.label}
            </span>
          ) : null}
          {policySummary ? (
            <span
              className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              title={policySummary.labelRight}
            >
              {policySummary.labelLeft}
              {policySummary.extra > 0 ? ` +${policySummary.extra}` : ''}
            </span>
          ) : null}
          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
            {item.created_at ? formatRelativeTime(item.created_at) : ''}
          </span>
        </div>
      </div>
    </div>
  )
}
