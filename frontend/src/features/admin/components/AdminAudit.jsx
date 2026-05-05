import { useEffect, useMemo, useState } from 'react'
import { FiCheck, FiChevronDown, FiChevronRight, FiCopy, FiDownload, FiFileText, FiRefreshCw, FiSearch } from 'react-icons/fi'
import { adminListAuditLogs } from '../services/admin.api'

function fmt(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

function badgeClass(action) {
  const a = String(action || '')
  if (a.startsWith('admin.user.')) return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200'
  if (a.startsWith('admin.')) return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200'
  if (a.startsWith('feedback.assign')) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
  if (a.startsWith('feedback.resolve')) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
  if (a.startsWith('feedback.')) return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
}

function toCsv(rows) {
  const header = ['time', 'actor_email', 'actor_user_id', 'action', 'target_type', 'target_id', 'meta_json']
  const escape = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push(
      [
        escape(r.created_at || ''),
        escape(r.actor_email || ''),
        escape(r.actor_user_id || ''),
        escape(r.action || ''),
        escape(r.target_type || ''),
        escape(r.target_id || ''),
        escape(JSON.stringify(r.meta || {})),
      ].join(',')
    )
  }
  return lines.join('\n')
}

export default function AdminAudit() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())
  const [copiedId, setCopiedId] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminListAuditLogs({ limit: 500 })
      setRows(data?.audit_logs || [])
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const hay = [
        r.action,
        r.target_type,
        r.target_id,
        r.actor_email,
        r.actor_user_id,
        JSON.stringify(r.meta || {}),
      ]
        .map((x) => String(x || '').toLowerCase())
        .join(' ')
      return hay.includes(q)
    })
  }, [rows, query])

  const toggleExpanded = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const copyMeta = async (r) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(r.meta || {}, null, 2))
      setCopiedId(r.id)
      window.setTimeout(() => setCopiedId(null), 1200)
    } catch {
      // ignore
    }
  }

  const exportCsv = () => {
    const csv = toCsv(filtered)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200">
            <FiFileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Audit logs</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Who did what, when — for admin and workflow governance.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden sm:block">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search action, actor, target, meta…"
                className="min-h-[40px] w-[340px] rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/40 focus:border-[#009750]/40 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
            >
              <FiDownload className="h-4 w-4" />
              Export
            </button>
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

        <div className="mt-4 sm:hidden">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search logs…"
              className="min-h-[40px] w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/40 focus:border-[#009750]/40 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
            />
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
          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 w-[44px]"></th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filtered.map((r) => {
                  const isOpen = expanded.has(r.id)
                  const actor = r.actor_email || r.actor_user_id || '-'
                  return (
                    <tr key={r.id} className="bg-white dark:bg-gray-950 align-top">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(r.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
                          title={isOpen ? 'Collapse' : 'Expand'}
                          aria-label={isOpen ? 'Collapse' : 'Expand'}
                        >
                          {isOpen ? <FiChevronDown className="h-4 w-4" /> : <FiChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{fmt(r.created_at)}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{actor}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeClass(r.action)}`}>
                          {r.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {r.target_type ? (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                            {r.target_type}:{r.target_id}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyMeta(r)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
                            title={copiedId === r.id ? 'Copied' : 'Copy meta JSON'}
                            aria-label="Copy meta JSON"
                          >
                            {copiedId === r.id ? <FiCheck className="h-4 w-4" /> : <FiCopy className="h-4 w-4" />}
                          </button>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {Object.keys(r.meta || {}).length} field(s)
                          </span>
                        </div>
                        {isOpen && (
                          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-200">
                            <pre className="whitespace-pre-wrap">{JSON.stringify(r.meta || {}, null, 2)}</pre>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No matching audit events.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

