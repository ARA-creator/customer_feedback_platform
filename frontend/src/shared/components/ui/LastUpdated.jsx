import { FiClock } from 'react-icons/fi'

/**
 * Subtle “data freshness” line for dashboards and lists.
 */
export default function LastUpdated({ at, prefix = 'Updated', className = '' }) {
  if (!at) return null
  const d = at instanceof Date ? at : new Date(at)
  if (Number.isNaN(d.getTime())) return null
  const rel = formatRelativeTime(d)
  return (
    <p
      className={`inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 ${className}`.trim()}
    >
      <FiClock className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      <span>
        {prefix} <time dateTime={d.toISOString()}>{rel}</time>
      </span>
    </p>
  )
}

function formatRelativeTime(d) {
  const t = d.getTime()
  const sec = Math.round((Date.now() - t) / 1000)
  if (sec < 45) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 14) return `${days}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
