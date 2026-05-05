import { useMemo, useState } from 'react'
import { FiArrowLeft, FiDownload } from 'react-icons/fi'
import { downloadCustomReportCsv } from '../services/reports.api'

export default function CustomReport({ onBack }) {
  const [sentiment, setSentiment] = useState('all')
  const [category, setCategory] = useState('all')
  const [source, setSource] = useState('all')
  const [priority, setPriority] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [limit, setLimit] = useState(2000)

  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState(null)

  const params = useMemo(
    () => ({
      sentiment,
      category,
      source,
      priority,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      limit,
    }),
    [sentiment, category, source, priority, dateFrom, dateTo, limit]
  )

  const download = async () => {
    setDownloading(true)
    setError(null)
    try {
      const res = await downloadCustomReportCsv(params)
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const disposition = res.headers?.['content-disposition'] || ''
      const match = /filename="([^"]+)"/.exec(disposition)
      a.href = url
      a.download = match?.[1] || 'custom_report.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to download report')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FiArrowLeft className="h-4 w-4" />
              Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Custom report</h1>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Build a filtered export directly from the database.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600">Sentiment</label>
            <select
              value={sentiment}
              onChange={(e) => setSentiment(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="high">High priority (≥80)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Source (exact)</label>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder="all, email, web, google_forms…"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-600">Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder="all or e.g. claims"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Limit</label>
            <input
              type="number"
              min={1}
              max={5000}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value || 2000))}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Date from</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Date to</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={download}
            disabled={downloading}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#009750] px-4 py-2 text-sm font-semibold text-white hover:bg-[#007a42] disabled:opacity-60"
          >
            <FiDownload className="h-4 w-4" />
            {downloading ? 'Preparing…' : 'Download CSV'}
          </button>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Note: search text filtering is not available in custom reports because message content is encrypted in the database.
        </p>
      </div>
    </div>
  )
}

