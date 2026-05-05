import { useEffect, useMemo, useState } from 'react'
import { FiActivity, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi'
import {
  adminCreateReleaseEvent,
  adminDeleteReleaseEvent,
  adminGetReleaseImpact,
  adminListReleaseEvents,
} from '../services/admin.api'

function fmtLocalInputValue(iso) {
  if (!iso) return ''
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return ''
  // datetime-local expects YYYY-MM-DDTHH:mm (no seconds)
  const pad = (n) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`
}

function toIsoFromLocalInput(value) {
  if (!value) return ''
  const t = new Date(value)
  if (Number.isNaN(t.getTime())) return ''
  return t.toISOString()
}

export default function AdminReleaseImpact() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [items, setItems] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [impact, setImpact] = useState(null)
  const [impactLoading, setImpactLoading] = useState(false)

  const [newTitle, setNewTitle] = useState('')
  const [newReleasedAt, setNewReleasedAt] = useState('')
  const [newPrefixes, setNewPrefixes] = useState('')

  const selected = useMemo(() => (items || []).find((x) => Number(x?.id) === Number(selectedId)) || null, [items, selectedId])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminListReleaseEvents()
      const arr = Array.isArray(res?.items) ? res.items : []
      setItems(arr)
      if (arr.length && !selectedId) setSelectedId(arr[0].id)
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load release events')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const loadImpact = async (rid) => {
    if (!rid) return
    setImpactLoading(true)
    setImpact(null)
    try {
      const res = await adminGetReleaseImpact({ release_id: rid, window_days: 7 })
      setImpact(res || null)
    } catch (e) {
      setImpact({ error: e?.response?.data?.error || e?.message || 'Failed to compute impact' })
    } finally {
      setImpactLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedId) return
    loadImpact(selectedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const create = async () => {
    setError(null)
    try {
      const prefixes = String(newPrefixes || '')
        .split(',')
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean)
      const released_at = toIsoFromLocalInput(newReleasedAt)
      if (!newTitle.trim()) throw new Error('Title is required')
      if (!released_at) throw new Error('Release time is required')
      await adminCreateReleaseEvent({ title: newTitle.trim(), released_at, product_prefixes: prefixes })
      setNewTitle('')
      setNewReleasedAt('')
      setNewPrefixes('')
      await load()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to create release event')
    }
  }

  const remove = async (rid) => {
    if (!rid) return
    setError(null)
    try {
      await adminDeleteReleaseEvent(rid)
      const next = (items || []).filter((x) => Number(x?.id) !== Number(rid))
      setItems(next)
      setSelectedId(next?.[0]?.id || null)
      setImpact(null)
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to delete release event')
    }
  }

  const before = impact?.sentiment?.before || null
  const after = impact?.sentiment?.after || null
  const top = Array.isArray(impact?.topics?.top_deltas) ? impact.topics.top_deltas : []

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#009750]/10 text-[#009750] dark:bg-emerald-500/10 dark:text-emerald-300">
            <FiActivity className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Release impact</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Track sentiment/topic shifts before vs after releases (association, not proof of causation).
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          Refresh
        </button>
      </div>

      {error && <div className="card p-4 text-sm text-rose-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-4 space-y-4">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Releases</div>
          {loading ? (
            <div className="text-sm text-gray-600 dark:text-gray-300">Loading…</div>
          ) : items.length ? (
            <div className="space-y-2">
              {items.map((r) => {
                const active = Number(selectedId) === Number(r?.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                      active
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100'
                        : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900'
                    }`}
                    title={r.title}
                  >
                    <div className="font-semibold truncate">{r.title}</div>
                    <div className="mt-0.5 text-[11px] opacity-80">{r.released_at ? new Date(r.released_at).toLocaleString() : '—'}</div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-300">No releases yet.</div>
          )}

          <div className="pt-2 border-t border-gray-200 dark:border-gray-800" />
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Add release</div>
          <div className="space-y-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title (e.g. New claims flow)"
              className="w-full min-h-[40px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <input
              type="datetime-local"
              value={newReleasedAt}
              onChange={(e) => setNewReleasedAt(e.target.value)}
              className="w-full min-h-[40px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <input
              value={newPrefixes}
              onChange={(e) => setNewPrefixes(e.target.value)}
              placeholder="Product prefixes (comma-separated, optional)"
              className="w-full min-h-[40px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={create}
              className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg bg-[#009750] px-3 py-2 text-xs font-semibold text-white hover:bg-[#007a42]"
            >
              <FiPlus className="h-4 w-4" aria-hidden />
              Create
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 card p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selected?.title || 'Select a release'}</div>
              <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                Released at:{' '}
                {selected?.released_at ? new Date(selected.released_at).toLocaleString() : '—'}
              </div>
              <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                Prefixes:{' '}
                {(selected?.product_prefixes || []).length ? selected.product_prefixes.join(', ') : 'All'}
              </div>
            </div>
            {selected?.id ? (
              <button
                type="button"
                onClick={() => remove(selected.id)}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/50"
                title="Delete release"
              >
                <FiTrash2 className="h-4 w-4" aria-hidden />
                Delete
              </button>
            ) : null}
          </div>

          {impactLoading ? (
            <div className="text-sm text-gray-600 dark:text-gray-300">Computing impact…</div>
          ) : impact?.error ? (
            <div className="text-sm text-rose-700">{impact.error}</div>
          ) : before && after ? (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  { label: 'Before total', value: before.total },
                  { label: 'After total', value: after.total },
                  { label: 'Negative share', value: `${after.negative_share}% (after) vs ${before.negative_share}% (before)` },
                ].map((c) => (
                  <div key={c.label} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">{c.label}</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{c.value ?? '—'}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Top topic changes</div>
                <div className="mt-2 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                      <tr>
                        <th className="px-4 py-3">Topic</th>
                        <th className="px-4 py-3">Before</th>
                        <th className="px-4 py-3">After</th>
                        <th className="px-4 py-3">Δ share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {(top.length ? top : []).map((r) => (
                        <tr key={r.topic}>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{r.topic}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                            {r.before_share}% ({r.before_count})
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                            {r.after_share}% ({r.after_count})
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{r.delta_share}%</td>
                        </tr>
                      ))}
                      {!top.length && (
                        <tr>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300" colSpan={4}>
                            No topic deltas available (low volume or no tags).
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-300">Select a release to view impact.</div>
          )}
        </div>
      </div>
    </div>
  )
}

