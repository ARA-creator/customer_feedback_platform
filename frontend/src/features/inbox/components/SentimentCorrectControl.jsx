import { useState } from 'react'
import { FiEdit2 } from 'react-icons/fi'
import { correctFeedbackSentiment } from '../services/inbox.api'

const LABELS = [
  { id: 'positive', label: 'Positive' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'negative', label: 'Negative' },
]

/**
 * Officer control to override a misclassified sentiment label.
 */
export default function SentimentCorrectControl({
  feedbackId,
  currentLabel,
  onCorrected,
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')

  if (!feedbackId) return null

  const apply = async (label) => {
    if (busy) return
    if (String(currentLabel || '').toLowerCase() === label) {
      setOpen(false)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await correctFeedbackSentiment(feedbackId, { label, note: note.trim() || undefined })
      onCorrected?.(res)
      setOpen(false)
      setNote('')
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to update sentiment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="inline-flex min-h-[28px] items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-900"
        title="Correct sentiment"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <FiEdit2 className="h-3 w-3" aria-hidden />
        Correct
      </button>
      {open ? (
        <div
          className="absolute left-0 top-full z-30 mt-1 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-950"
          role="dialog"
          aria-label="Correct sentiment"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Set sentiment
          </p>
          <div className="mt-1.5 flex flex-col gap-1">
            {LABELS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={busy}
                onClick={() => apply(opt.id)}
                className={`rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition-colors ${
                  String(currentLabel || '').toLowerCase() === opt.id
                    ? 'bg-[#009750]/10 text-[#007a42] dark:bg-emerald-950/40 dark:text-emerald-200'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900'
                } disabled:opacity-60`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <label className="mt-2 block px-1">
            <span className="sr-only">Optional note</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
              className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
          {error ? <p className="mt-1 px-1 text-[10px] text-rose-600 dark:text-rose-300">{error}</p> : null}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-1 w-full rounded-lg px-2 py-1 text-[10px] font-semibold text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-900"
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  )
}
