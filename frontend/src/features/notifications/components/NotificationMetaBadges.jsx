import { SourcePill } from '../../dashboard/components/SourceIndicators'
import { formatSentimentWord } from '../../dashboard/utils/dashboardFormatters'
import { resolveSentimentKind } from '../../../shared/lib/sentimentDisplay'

function SentimentPill({ label }) {
  const kind = resolveSentimentKind(label)
  const style =
    kind === 'negative'
      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300'
      : kind === 'positive'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
        : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200'
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize ${style}`}
    >
      {formatSentimentWord(label) || String(label || 'unknown')}
    </span>
  )
}

/**
 * Channel + sentiment pills for new_feedback notifications.
 * Falls back to plain body text when meta is missing.
 */
export default function NotificationMetaBadges({ meta, body, className = '' }) {
  const source = String(meta?.source || '').trim()
  const sentiment = String(meta?.sentiment_label || meta?.sentiment || '').trim()
  if (!source && !sentiment) {
    if (!body) return null
    return <p className={`text-xs text-gray-600 dark:text-gray-300 ${className}`.trim()}>{body}</p>
  }
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`.trim()}>
      {source ? <SourcePill source={source} /> : null}
      {sentiment ? <SentimentPill label={sentiment} /> : null}
    </div>
  )
}
