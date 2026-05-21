import { useEffect, useMemo, useState } from 'react'
import { FiActivity, FiAlertTriangle, FiInbox, FiLink2, FiRefreshCw, FiShield, FiUsers } from 'react-icons/fi'
import { adminGetOverview, adminReprocessInsuranceTags, adminReprocessSentiment } from '../services/admin.api'

const PENDING_USERS_SCOPE_KEY = 'cfp_admin_users_scope'

export default function AdminOverview({ auth, onNavigate }) {
  const perms = Array.isArray(auth?.permissions) ? auth.permissions : []
  const canIntegrations = perms.includes('admin.manage_integrations')
  const canManageUsers = perms.includes('admin.manage_users')
  const canApproveReplies = perms.includes('feedback.approve') || canManageUsers

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [health, setHealth] = useState(null)
  const [insuranceReprocessBusy, setInsuranceReprocessBusy] = useState(false)
  const [insuranceReprocessLog, setInsuranceReprocessLog] = useState('')
  const [sentimentReprocessBusy, setSentimentReprocessBusy] = useState(false)
  const [sentimentReprocessLog, setSentimentReprocessLog] = useState('')

  const ingestion = useMemo(() => health?.ingestion || [], [health])
  const queue = useMemo(() => health?.queue || {}, [health])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminGetOverview()
      setHealth(data?.org_health || null)
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load admin overview')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const goPendingUsers = () => {
    try {
      sessionStorage.setItem(PENDING_USERS_SCOPE_KEY, 'pending')
    } catch {
      // ignore
    }
    onNavigate?.('admin_users')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200">
            <FiShield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Admin overview</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Org health and governance tools. Access is controlled by RBAC permissions.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
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

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
              <FiInbox className="h-4 w-4" />
              Open feedback
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {loading ? '…' : queue.open ?? '—'}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Not resolved or closed</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
              <FiActivity className="h-4 w-4" />
              SLA breaches
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {loading ? '…' : queue.sla_breaches ?? '—'}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Past due, still open</div>
          </div>
          {canApproveReplies ? (
            <button
              type="button"
              onClick={() => onNavigate?.('admin_reply_approvals')}
              className="rounded-2xl border border-gray-200 bg-white p-4 text-left hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900/80"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                <FiShield className="h-4 w-4" />
                Reply approvals
              </div>
              <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {loading ? '…' : queue.approval_pending ?? '—'}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Draft replies awaiting approval</div>
            </button>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                <FiShield className="h-4 w-4" />
                Reply approvals
              </div>
              <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {loading ? '…' : queue.approval_pending ?? '—'}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Draft replies awaiting approval</div>
            </div>
          )}
          <div
            className={`rounded-2xl border p-4 ${
              queue.negative_spike_alert
                ? 'border-rose-300 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/40'
                : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
              {queue.negative_spike_alert ? (
                <FiAlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-300" />
              ) : (
                <FiActivity className="h-4 w-4" />
              )}
              Negative (24h)
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {loading ? '…' : queue.negative_24h ?? '—'}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {queue.negative_spike_alert ? 'Elevated vs 7-day baseline' : 'Last 24 hours'}
            </div>
          </div>
        </div>

        {!loading && Number(queue.external_users_pending) > 0 && canManageUsers && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            <span className="font-semibold">{queue.external_users_pending}</span> external signup
            {Number(queue.external_users_pending) === 1 ? '' : 's'} awaiting admin approval.{' '}
            <button type="button" onClick={goPendingUsers} className="font-semibold underline hover:no-underline">
              Review in Users → Pending
            </button>
          </div>
        )}

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Org health</h2>
          {loading ? (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Last sync (proxy)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {ingestion.length === 0 ? (
                    <tr>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400" colSpan={2}>
                        No ingestion data yet.
                      </td>
                    </tr>
                  ) : (
                    ingestion.map((row) => (
                      <tr key={row.source} className="bg-white dark:bg-gray-950">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{row.source}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{row.last_seen_at || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Quick actions</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {canManageUsers && (
              <button
                type="button"
                onClick={() => onNavigate?.('admin_users')}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
              >
                <FiUsers className="h-4 w-4" />
                Manage users
              </button>
            )}
            {canManageUsers && (
              <button
                type="button"
                onClick={() => onNavigate?.('admin_activity')}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
              >
                <FiActivity className="h-4 w-4" />
                User activity
              </button>
            )}
            {canManageUsers && Number(queue.external_users_pending) > 0 && (
              <button
                type="button"
                onClick={goPendingUsers}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
              >
                <FiUsers className="h-4 w-4" />
                Pending signups ({queue.external_users_pending})
              </button>
            )}
            {canApproveReplies && Number(queue.approval_pending) > 0 && (
              <button
                type="button"
                onClick={() => onNavigate?.('admin_reply_approvals')}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-950 hover:bg-violet-100 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-100"
              >
                <FiShield className="h-4 w-4" />
                Reply queue ({queue.approval_pending})
              </button>
            )}
            {canIntegrations && (
              <button
                type="button"
                onClick={() => onNavigate?.('admin_integrations')}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
              >
                <FiLink2 className="h-4 w-4" />
                Integrations health
              </button>
            )}
            {canIntegrations && (
              <button
                type="button"
                disabled={insuranceReprocessBusy || sentimentReprocessBusy}
                onClick={async () => {
                  if (
                    !window.confirm(
                      'Recompute themes for all feedback (oldest first, batches of 500)? Existing themes are overwritten when force=true. Continue?',
                    )
                  ) {
                    return
                  }
                  setInsuranceReprocessBusy(true)
                  setInsuranceReprocessLog('')
                  let totalUpdated = 0
                  let totalScanned = 0
                  let batches = 0
                  let cursorId = undefined
                  const lines = []
                  try {
                    while (batches < 500) {
                      batches += 1
                      const params = {
                        order: 'oldest',
                        limit: 500,
                        force: 'true',
                        dry_run: 'false',
                      }
                      if (cursorId != null) params.cursor_id = cursorId
                      const body = await adminReprocessInsuranceTags(params)
                      if (!body?.ok) {
                        lines.push(`Batch ${batches}: error — ${body?.error || 'unknown'}`)
                        break
                      }
                      totalUpdated += Number(body.updated || 0)
                      totalScanned += Number(body.scanned || 0)
                      lines.push(
                        `Batch ${batches}: scanned=${body.scanned} updated=${body.updated} skipped=${body.skipped} done=${body.done}`,
                      )
                      if (body.done) break
                      const next = body.next_cursor
                      if (!next || next.cursor_id == null) break
                      cursorId = next.cursor_id
                    }
                    lines.push(`Finished: updated=${totalUpdated} scanned=${totalScanned} batches=${batches}`)
                    setInsuranceReprocessLog(lines.join('\n'))
                  } catch (e) {
                    setInsuranceReprocessLog(
                      `${lines.join('\n')}\nError: ${e?.response?.data?.error || e?.message || 'request failed'}`,
                    )
                  } finally {
                    setInsuranceReprocessBusy(false)
                  }
                }}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
              >
                <FiRefreshCw className={`h-4 w-4 ${insuranceReprocessBusy ? 'animate-spin' : ''}`} />
                Backfill themes
              </button>
            )}
            {canIntegrations && (
              <button
                type="button"
                disabled={insuranceReprocessBusy || sentimentReprocessBusy}
                onClick={async () => {
                  if (
                    !window.confirm(
                      'Recompute sentiment for ALL feedback (oldest first, batches of 500, force overwrite)? Missing insurance tags will be computed and saved for gating. This may take a while. Continue?',
                    )
                  ) {
                    return
                  }
                  setSentimentReprocessBusy(true)
                  setSentimentReprocessLog('')
                  let totalUpdated = 0
                  let totalScanned = 0
                  let batches = 0
                  let cursorId = undefined
                  const lines = []
                  try {
                    while (batches < 500) {
                      batches += 1
                      const params = {
                        order: 'oldest',
                        limit: 500,
                        force: 'true',
                        dry_run: 'false',
                      }
                      if (cursorId != null) params.cursor_id = cursorId
                      const body = await adminReprocessSentiment(params)
                      if (!body?.ok) {
                        lines.push(`Batch ${batches}: error — ${body?.error || 'unknown'}`)
                        break
                      }
                      totalUpdated += Number(body.updated || 0)
                      totalScanned += Number(body.scanned || 0)
                      lines.push(
                        `Batch ${batches}: scanned=${body.scanned} updated=${body.updated} skipped=${body.skipped} done=${body.done}`,
                      )
                      if (body.done) break
                      const next = body.next_cursor
                      if (!next || next.cursor_id == null) break
                      cursorId = next.cursor_id
                    }
                    lines.push(`Finished: updated=${totalUpdated} scanned=${totalScanned} batches=${batches}`)
                    setSentimentReprocessLog(lines.join('\n'))
                  } catch (e) {
                    setSentimentReprocessLog(
                      `${lines.join('\n')}\nError: ${e?.response?.data?.error || e?.message || 'request failed'}`,
                    )
                  } finally {
                    setSentimentReprocessBusy(false)
                  }
                }}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-950 hover:bg-sky-100 disabled:opacity-60 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100 dark:hover:bg-sky-950/60"
              >
                <FiRefreshCw className={`h-4 w-4 ${sentimentReprocessBusy ? 'animate-spin' : ''}`} />
                Backfill sentiment
              </button>
            )}
          </div>
        </div>

        {insuranceReprocessLog && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs font-mono text-amber-950 whitespace-pre-wrap dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
            <div className="mb-1 font-semibold text-amber-900 dark:text-amber-200">Themes</div>
            {insuranceReprocessLog}
          </div>
        )}
        {sentimentReprocessLog && (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-xs font-mono text-sky-950 whitespace-pre-wrap dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-100">
            <div className="mb-1 font-semibold text-sky-900 dark:text-sky-200">Sentiment</div>
            {sentimentReprocessLog}
          </div>
        )}

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Your permissions</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {perms.length === 0 && (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                No permissions loaded
              </span>
            )}
            {perms.slice(0, 40).map((p) => (
              <span key={p} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                {p}
              </span>
            ))}
          </div>
          {perms.length > 40 && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Showing first 40 permissions.</p>
          )}
        </div>
      </div>
    </div>
  )
}
