import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiChevronRight } from 'react-icons/fi'
import { adminListActivity } from '../../../features/admin/services/admin.api'

function formatAction(action) {
  return String(action || '')
    .replace(/^admin\./, '')
    .replace(/\./g, ' · ')
}

function formatWhen(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function SettingsRecentActivity({ auth, canViewActivity }) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!canViewActivity) return undefined
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await adminListActivity({ limit: 30 })
        if (!mounted) return
        setItems(data?.items || [])
      } catch (e) {
        if (mounted) setError(e?.response?.data?.error || e?.message || 'Failed to load activity')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [canViewActivity])

  const recent = useMemo(() => {
    const email = String(auth?.email || '').toLowerCase()
    const mine = items.filter((r) => String(r.actor_email || '').toLowerCase() === email)
    const list = mine.length > 0 ? mine : items
    return list.slice(0, 5)
  }, [items, auth?.email])

  if (!canViewActivity) return null

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent activity</h2>
        <Link
          to="/admin/activity"
          className="inline-flex items-center gap-0.5 text-xs font-medium text-[#009750] hover:text-[#007a42] dark:text-emerald-400"
        >
          View all
          <FiChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      {loading && <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Loading…</p>}
      {error && <p className="mt-3 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
      {!loading && !error && recent.length === 0 && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">No recent activity recorded.</p>
      )}
      {!loading && !error && recent.length > 0 && (
        <ul className="mt-3 space-y-3">
          {recent.map((row) => (
            <li key={row.id} className="flex gap-3 text-xs">
              <span className="shrink-0 text-gray-400 dark:text-gray-500 w-[7.5rem]">
                {formatWhen(row.created_at)}
              </span>
              <span className="min-w-0 text-gray-700 dark:text-gray-300">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {row.actor_email || 'System'}
                </span>
                {' · '}
                {formatAction(row.action)}
                {row.target_email ? ` · ${row.target_email}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
