import { useEffect, useState } from 'react'
import { FiCheck, FiRefreshCw, FiShield, FiX } from 'react-icons/fi'
import { adminApproveReplyDraft, adminListApprovalQueue, adminRejectReplyDraft } from '../services/admin.api'

export default function AdminReplyApprovals() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [items, setItems] = useState([])
  const [rejectId, setRejectId] = useState(null)
  const [rejectNote, setRejectNote] = useState('')

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
    setSaving(true)
    setError(null)
    try {
      await adminApproveReplyDraft(draftId, {})
      await load()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to approve')
    } finally {
      setSaving(false)
    }
  }

  const reject = async () => {
    if (!rejectId || !rejectNote.trim()) return
    setSaving(true)
    setError(null)
    try {
      await adminRejectReplyDraft(rejectId, { note: rejectNote.trim() })
      setRejectId(null)
      setRejectNote('')
      await load()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to reject')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200">
            <FiShield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Reply approvals</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Public and external-channel reply drafts awaiting approval before send.
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
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">No drafts awaiting approval.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {items.map((draft) => {
              const fb = draft.feedback || {}
              return (
                <div
                  key={draft.id}
                  className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800 dark:bg-gray-950/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Feedback #{fb.id || draft.feedback_id}
                        {fb.source ? ` · ${fb.source}` : ''}
                        {fb.sentiment_label ? ` · ${fb.sentiment_label}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Draft #{draft.id} · {draft.visibility} · by {draft.created_by_email || 'unknown'}
                        {draft.created_at ? ` · ${new Date(draft.created_at).toLocaleString()}` : ''}
                      </p>
                      {fb.message_preview && (
                        <p className="mt-2 text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                          Customer: {fb.message_preview}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => approve(draft.id)}
                        className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60"
                      >
                        <FiCheck className="h-4 w-4" />
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setRejectId(draft.id)
                          setRejectNote('')
                        }}
                        className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900 hover:bg-rose-100 disabled:opacity-60"
                      >
                        <FiX className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-wrap dark:bg-gray-900 dark:text-gray-200">
                    {draft.body}
                  </div>
                  {draft.alt_body && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Alt: {draft.alt_body.slice(0, 120)}
                      {draft.alt_body.length > 120 ? '…' : ''}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {rejectId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-950">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Reject draft</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Add a note for the author (required).</p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={4}
              className="mt-4 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              placeholder="Reason for rejection…"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectId(null)
                  setRejectNote('')
                }}
                className="flex-1 min-h-[44px] rounded-lg border border-gray-200 bg-white text-sm font-semibold dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !rejectNote.trim()}
                onClick={reject}
                className="flex-1 min-h-[44px] rounded-lg bg-rose-600 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
