import { useEffect, useState } from 'react'
import { FiActivity, FiRefreshCw } from 'react-icons/fi'
import { adminListActivity } from '../services/admin.api'

function formatAction(action) {
  return String(action || '')
    .replace(/^admin\./, '')
    .replace(/\./g, ' · ')
}

export default function AdminUserActivity() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [items, setItems] = useState([])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminListActivity({ limit: 200 })
      setItems(data?.items || [])
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200">
            <FiActivity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">User activity</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Platform-wide audit trail — signups, approvals, role changes, and admin actions across all users.
            </p>
          </div>
          <div className="ml-auto">
            <button
              type="button"
              onClick={load}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        )}

        {loading ? (
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">No activity recorded yet.</p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {items.map((row) => (
                  <tr key={row.id} className="bg-white dark:bg-gray-950">
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                      {row.actor_email || (row.actor_user_id ? `User #${row.actor_user_id}` : 'System')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {formatAction(row.action)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {row.target_email || row.target_id || '—'}
                      {row.target_type ? (
                        <span className="ml-1 text-xs text-gray-400">({row.target_type})</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
