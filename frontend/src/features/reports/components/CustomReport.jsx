import { useMemo, useState } from 'react'
import { FiArrowLeft, FiDownload } from 'react-icons/fi'
import { downloadAnalystExport } from '../services/reports.api'

import { REPORT_FIELD_CLASSES as FIELD_CLASSES } from '../reportFieldClasses'

const FORMAT_META = {
  csv: { mime: 'text/csv;charset=utf-8;', fallback: 'feedback_export.csv', label: 'CSV' },
  xlsx: {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fallback: 'feedback_export.xlsx',
    label: 'Excel',
  },
  pdf: { mime: 'application/pdf', fallback: 'feedback_export.pdf', label: 'PDF' },
}

async function blobErrorMessage(err) {
  const data = err?.response?.data
  if (!data) return err?.message || 'Failed to download report'
  if (typeof data === 'string') return data
  if (data instanceof Blob) {
    try {
      const text = await data.text()
      const parsed = JSON.parse(text)
      if (parsed?.error) return parsed.error
    } catch {
      /* ignore */
    }
  }
  if (typeof data?.error === 'string') return data.error
  return err?.message || 'Failed to download report'
}

export default function CustomReport({ onBack, embedded = false }) {
  const [sentiment, setSentiment] = useState('all')
  const [theme, setTheme] = useState('all')
  const [source, setSource] = useState('all')
  const [priority, setPriority] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [limit, setLimit] = useState(2000)

  const [downloading, setDownloading] = useState(null)
  const [error, setError] = useState(null)

  const params = useMemo(
    () => ({
      sentiment,
      theme,
      source,
      priority,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      limit,
      time_window: 'all',
    }),
    [sentiment, theme, source, priority, dateFrom, dateTo, limit]
  )

  const download = async (format) => {
    const fmt = String(format || 'csv').toLowerCase()
    const meta = FORMAT_META[fmt] || FORMAT_META.csv
    setDownloading(fmt)
    setError(null)
    try {
      const res = await downloadAnalystExport(params, fmt)
      const blob = new Blob([res.data], { type: meta.mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const disposition = res.headers?.['content-disposition'] || ''
      const match = /filename="([^"]+)"/.exec(disposition)
      a.href = url
      a.download = match?.[1] || meta.fallback
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(await blobErrorMessage(e))
    } finally {
      setDownloading(null)
    }
  }

  const busy = Boolean(downloading)

  return (
    <div className={embedded ? 'space-y-6' : 'p-6 space-y-6'}>
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                >
                  <FiArrowLeft className="h-4 w-4" />
                  Back
                </button>
              )}
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Custom report</h1>
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Build a filtered export directly from the database.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Sentiment</label>
            <select
              value={sentiment}
              onChange={(e) => setSentiment(e.target.value)}
              className={FIELD_CLASSES}
            >
              <option value="all">All</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={FIELD_CLASSES}
            >
              <option value="all">All</option>
              <option value="high">High priority (≥80)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Source (exact)</label>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className={FIELD_CLASSES}
              placeholder="all, email, web, jotform…"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Theme</label>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className={FIELD_CLASSES}
              placeholder="all or e.g. claims"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Limit</label>
            <input
              type="number"
              min={1}
              max={5000}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value || 2000))}
              className={FIELD_CLASSES}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Date from</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={FIELD_CLASSES}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Date to</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={FIELD_CLASSES}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          {(['csv', 'xlsx', 'pdf']).map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => download(fmt)}
              disabled={busy}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#009750] px-4 py-2 text-sm font-semibold text-white hover:bg-[#007a42] disabled:opacity-60"
            >
              <FiDownload className="h-4 w-4" />
              {downloading === fmt ? 'Preparing…' : `Download ${FORMAT_META[fmt].label}`}
            </button>
          ))}
        </div>

        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Downloads one tidy file with one row per feedback (CSV, Excel, or PDF), including sentiment,
          priority, theme, assignment, and response times. Email HTML is converted to plain text.
        </p>
      </div>
    </div>
  )
}
