import { useEffect, useMemo, useState } from 'react'
import { FiCheck, FiInbox, FiRefreshCw, FiX } from 'react-icons/fi'
import { adminApproveReplyDraft, adminListApprovalQueue, adminRejectReplyDraft } from '../services/admin.api'

function fmt(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

export default function AdminApprovalQueue() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [items, setItems] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [rejectNoteById, setRejectNoteById] = useState({})

  const pending = useMemo(() => items || [], [items])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminListApprovalQueue({ limit: 200 })
      setItems(data?.items || [])
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load approval queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const approve = async (draftId) => {
    setBusyId(draftId)
    setError(null)
    try {
      await adminApproveReplyDraft(draftId)
      await load()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to approve draft')
    } finally {
      setBusyId(null)
    }
  }

  const reject = async (draftId) => {
    setBusyId(draftId)
    setError(null)
    try {
      const note = String(rejectNoteById[draftId] || '').trim()
      await adminRejectReplyDraft(draftId, { note })
      await load()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to reject draft')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200">
            <FiInbox className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Approval queue</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Drafts that require approval before a public response can be sent.
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
        ) : (
          <div className="mt-6 space-y-3">
            {pending.length === 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
                No pending drafts.
              </div>
            )}
            {pending.map((row) => {
              const draft = row?.draft
              const fb = row?.feedback
              const wf = row?.workflow
              const id = draft?.id
              const busy = busyId === id
              return (
                <div key={id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        #{fb?.id} • {fb?.source} • {fmt(draft?.created_at)}
                      </div>
                      <div className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {draft?.visibility === 'public' ? 'Public reply' : 'Reply'}
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                          {wf?.approval_status || draft?.approval_status || 'pending'}
                        </span>
                      </div>
                      <div className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
                        {draft?.body}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300">Rejection reason (required)</label>
                    <div className="mt-1 flex items-stretch gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => approve(id)}
                        title="Approve"
                        aria-label="Approve"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#009750] text-white hover:bg-[#007a42] disabled:opacity-60"
                      >
                        <FiCheck className="h-5 w-5" />
                      </button>
                      <textarea
                        value={rejectNoteById[id] || ''}
                        onChange={(e) => setRejectNoteById((prev) => ({ ...prev, [id]: e.target.value }))}
                        rows={2}
                        className="min-h-[40px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/40 focus:border-[#009750]/40 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
                        placeholder="Why is this draft being rejected? (policy, tone, missing info…)"
                      />
                      <button
                        type="button"
                        disabled={busy || !String(rejectNoteById[id] || '').trim()}
                        onClick={() => reject(id)}
                        title="Reject"
                        aria-label="Reject"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/40"
                      >
                        <FiX className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

