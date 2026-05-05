import { useEffect, useState } from 'react'
import { FiBarChart2, FiRefreshCw } from 'react-icons/fi'
import { adminGetAnalytics } from '../services/admin.api'

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await adminGetAnalytics({ days: 30 })
      setData(resp || null)
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load analytics')
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
            <FiBarChart2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Admin analytics</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Org-wide metrics (last 30 days).</p>
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
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">Feedback (30d)</div>
              <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{data?.totals?.feedback ?? '—'}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">Resolved (all-time)</div>
              <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{data?.totals?.resolved ?? '—'}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">Window</div>
              <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{data?.window_days ?? 30}d</div>
            </div>

            <div className="md:col-span-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">By source</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(data?.by_source || []).map((r) => (
                  <span key={r.source} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                    {r.source}: {r.count}
                  </span>
                ))}
                {(data?.by_source || []).length === 0 && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">No data.</span>
                )}
              </div>
            </div>

            <div className="md:col-span-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">By sentiment</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(data?.by_sentiment || []).map((r) => (
                  <span key={r.sentiment} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                    {r.sentiment}: {r.count}
                  </span>
                ))}
                {(data?.by_sentiment || []).length === 0 && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">No data.</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

