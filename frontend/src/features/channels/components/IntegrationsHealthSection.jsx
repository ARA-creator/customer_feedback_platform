import { useCallback, useEffect, useState } from 'react'
import { adminIntegrationsStatus } from '../../admin/services/admin.api'

function fmt(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

/**
 * Ingestion activity per source (last feedback seen). Shown on Admin → Channels.
 */
export default function IntegrationsHealthSection() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sources, setSources] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminIntegrationsStatus()
      setSources(data?.sources || [])
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load integrations status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Integrations health</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Ingestion activity per channel (last feedback received).
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2.5">Source</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Last ingested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {sources.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400" colSpan={3}>
                    No ingestion data yet.
                  </td>
                </tr>
              ) : (
                sources.map((s) => (
                  <tr key={s.source} className="bg-white dark:bg-gray-950">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{s.source}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          s.status === 'ok'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200'
                        }`}
                      >
                        {s.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                      {fmt(s.last_ingested_at) || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
