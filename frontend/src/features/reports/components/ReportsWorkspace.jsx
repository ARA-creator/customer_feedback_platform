import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FiAlertTriangle,
  FiBox,
  FiDownload,
  FiMessageSquare,
  FiMoreHorizontal,
  FiPlus,
  FiTrash2,
  FiTrendingUp,
} from 'react-icons/fi'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getProductPulse } from '../../dashboard/services/dashboard.api'
import { SENTIMENT_COLORS } from '../../dashboard/constants/palette'
import { REPORT_FIELD_CLASSES, REPORT_LABEL_CLASSES } from '../reportFieldClasses'
import {
  createReportSchedule,
  deleteReportSchedule,
  downloadAnalystExport,
  getReportPreview,
  listReportSchedules,
  updateReportSchedule,
} from '../services/reports.api'
import { blobErrorMessage, formatLabel, triggerExportDownload } from '../utils/downloadExport'
import { formatDisplayRange, formatTrendTick, thisWeekRange } from '../utils/reportDates'

const SENTIMENT_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'positive', label: 'Positive' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'negative', label: 'Negative' },
]

const CADENCES = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
]

function buildExportParams(filters, overrides = {}) {
  const params = {
    sentiment: filters.sentiment || 'all',
    source: filters.source || 'all',
    priority: filters.priority || 'all',
    category: 'all',
    date_from: filters.dateFrom || undefined,
    date_to: filters.dateTo || undefined,
    limit: 5000,
    time_window: 'all',
    ...overrides,
  }
  if (filters.productKey && filters.productKey !== 'all') {
    const [prefix, group = ''] = String(filters.productKey).split('|')
    if (prefix) {
      params.product_prefix = prefix
      params.product_group = group
    }
  }
  Object.keys(params).forEach((k) => {
    if (params[k] === undefined || params[k] === '') delete params[k]
  })
  return params
}

function SentimentBar({ label, pct, color }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-800 dark:text-gray-200">{label}</span>
        <span className="tabular-nums text-gray-600 dark:text-gray-400">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function FormatLinks({ onDownload, disabled, busyFormat }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold">
      {(['csv', 'xlsx', 'pdf']).map((fmt, i) => (
        <span key={fmt} className="inline-flex items-center gap-2">
          {i > 0 && <span className="text-gray-300 dark:text-gray-600">|</span>}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onDownload(fmt)}
            className="text-[#009750] hover:underline disabled:opacity-50"
          >
            {busyFormat === fmt ? '…' : formatLabel(fmt)}
          </button>
        </span>
      ))}
    </div>
  )
}

function cadenceSummary(schedule) {
  const cadence = String(schedule.cadence || '').toLowerCase()
  const time = schedule.time_of_day || '08:00'
  if (cadence === 'daily') return `Every day ${time}`
  if (cadence === 'weekly') return `Every Mon ${time}`
  if (cadence === 'monthly') return `1st of month`
  return `${cadence} ${time}`
}

export default function ReportsWorkspace() {
  const week = useMemo(() => thisWeekRange(), [])
  const [filters, setFilters] = useState({
    dateFrom: week.dateFrom,
    dateTo: week.dateTo,
    sentiment: 'all',
    source: 'all',
    productKey: 'all',
    priority: 'all',
  })

  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [error, setError] = useState(null)
  const [downloading, setDownloading] = useState(null)

  const [schedules, setSchedules] = useState([])
  const [schedulesLoading, setSchedulesLoading] = useState(true)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [scheduleMenuId, setScheduleMenuId] = useState(null)
  const [scheduleForm, setScheduleForm] = useState({
    name: 'Weekly summary',
    cadence: 'weekly',
    timeOfDay: '08:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    recipients: '',
    format: 'csv',
  })

  const exportParams = useMemo(() => buildExportParams(filters), [filters])

  const loadPreview = useCallback(async (params) => {
    setPreviewLoading(true)
    try {
      const data = await getReportPreview(params)
      setPreview(data)
      setError(null)
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load preview')
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  const loadSchedules = useCallback(async () => {
    setSchedulesLoading(true)
    try {
      const data = await listReportSchedules()
      setSchedules(data?.schedules || [])
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load schedules')
    } finally {
      setSchedulesLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSchedules()
    getProductPulse({ time_window: 'all' })
      .then((data) => {
        const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
        setProducts(rows.filter((r) => (Number(r?.total) || 0) > 0))
      })
      .catch(() => setProducts([]))
  }, [loadSchedules])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      loadPreview(exportParams)
    }, 250)
    return () => window.clearTimeout(handle)
  }, [exportParams, loadPreview])

  const download = async (format, params = exportParams) => {
    const key = `${format}:${JSON.stringify(params)}`
    setDownloading(key)
    setError(null)
    try {
      await triggerExportDownload(downloadAnalystExport, params, format)
    } catch (e) {
      setError(await blobErrorMessage(e))
    } finally {
      setDownloading(null)
    }
  }

  const isBusy = Boolean(downloading)

  const applyQuickPack = (packId) => {
    const range = thisWeekRange()
    if (packId === 'week') {
      setFilters((f) => ({ ...f, ...{ dateFrom: range.dateFrom, dateTo: range.dateTo, sentiment: 'all', source: 'all', productKey: 'all', priority: 'all' } }))
    } else if (packId === 'negative') {
      setFilters((f) => ({ ...f, dateFrom: range.dateFrom, dateTo: range.dateTo, sentiment: 'negative', source: 'all', productKey: 'all', priority: 'all' }))
    } else if (packId === 'by_channel') {
      setFilters((f) => ({ ...f, dateFrom: range.dateFrom, dateTo: range.dateTo, sentiment: 'all', source: 'all', productKey: 'all', priority: 'all' }))
    } else if (packId === 'by_product') {
      setFilters((f) => ({ ...f, dateFrom: range.dateFrom, dateTo: range.dateTo, sentiment: 'all', source: 'all', productKey: 'all', priority: 'all' }))
    }
  }

  const quickDownload = (packId, format) => {
    const range = thisWeekRange()
    let params = buildExportParams({
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      sentiment: packId === 'negative' ? 'negative' : 'all',
      source: 'all',
      productKey: 'all',
      priority: 'all',
    })
    download(format, params)
    applyQuickPack(packId)
  }

  const toggleSchedule = async (schedule) => {
    try {
      await updateReportSchedule(schedule.id, { enabled: !schedule.enabled })
      await loadSchedules()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to update schedule')
    }
  }

  const removeSchedule = async (id) => {
    setScheduleMenuId(null)
    try {
      await deleteReportSchedule(id)
      await loadSchedules()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to delete schedule')
    }
  }

  const createSchedule = async () => {
    const recipients = scheduleForm.recipients
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    if (scheduleForm.name.trim().length < 3 || recipients.length === 0) {
      setError('Schedule needs a name (3+ chars) and at least one recipient email.')
      return
    }
    try {
      await createReportSchedule({
        name: scheduleForm.name.trim(),
        cadence: scheduleForm.cadence,
        time_of_day: scheduleForm.timeOfDay,
        timezone: scheduleForm.timezone,
        recipients,
        format: scheduleForm.format,
        enabled: true,
        filters: exportParams,
      })
      setShowScheduleForm(false)
      setScheduleForm((f) => ({ ...f, recipients: '' }))
      await loadSchedules()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to create schedule')
    }
  }

  const sentiment = preview?.sentiment || {
    positive: 0,
    neutral: 0,
    negative: 0,
    positive_pct: 0,
    neutral_pct: 0,
    negative_pct: 0,
  }
  const total = preview?.total ?? 0
  const themes = preview?.themes || []
  const trends = preview?.trends || []
  const channels = preview?.channels || []
  const quick = preview?.quick || {}

  const productOptions = useMemo(() => {
    return products.map((p) => {
      const prefix = p.product_prefix || ''
      const group = p.product_group || ''
      const key = `${prefix}|${group}`
      const label = group || prefix || 'Product'
      return { value: key, label: `${label}${prefix ? ` (${prefix})` : ''}` }
    })
  }, [products])

  const quickPacks = [
    {
      id: 'week',
      title: "This week's sentiment",
      icon: FiTrendingUp,
      iconClass: 'text-[#009750] bg-emerald-50 dark:bg-emerald-950/40',
      count: quick?.week?.total,
    },
    {
      id: 'negative',
      title: 'Negative only',
      icon: FiAlertTriangle,
      iconClass: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40',
      count: quick?.negative?.total,
    },
    {
      id: 'by_channel',
      title: 'By channel',
      icon: FiMessageSquare,
      iconClass: 'text-slate-600 bg-slate-100 dark:bg-slate-800',
      count: quick?.by_channel?.total,
    },
    {
      id: 'by_product',
      title: 'By product',
      icon: FiBox,
      iconClass: 'text-slate-600 bg-slate-100 dark:bg-slate-800',
      count: quick?.by_product?.total,
    },
  ]

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      {/* Quick reports */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Quick reports</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickPacks.map((pack) => {
            const Icon = pack.icon
            return (
              <div
                key={pack.id}
                className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
              >
                <div className="flex items-start gap-3">
                  <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${pack.iconClass}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => applyQuickPack(pack.id)}
                      className="text-left text-sm font-semibold text-gray-900 hover:text-[#009750] dark:text-gray-100"
                    >
                      {pack.title}
                    </button>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {pack.count == null ? '—' : `${Number(pack.count).toLocaleString()} feedback`}
                    </p>
                    <div className="mt-3">
                      <FormatLinks
                        disabled={isBusy}
                        busyFormat={downloading ? downloading.split(':')[0] : null}
                        onDownload={(fmt) => quickDownload(pack.id, fmt)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Build + Preview */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-5 dark:border-gray-800 dark:bg-gray-950">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Build a report</h2>

          <div className="mt-4 space-y-4">
            <div>
              <label className={REPORT_LABEL_CLASSES}>Date range</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                  className={REPORT_FIELD_CLASSES}
                  aria-label="Date from"
                />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  className={REPORT_FIELD_CLASSES}
                  aria-label="Date to"
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                {formatDisplayRange(filters.dateFrom, filters.dateTo)}
              </p>
            </div>

            <div>
              <label className={REPORT_LABEL_CLASSES}>Sentiment</label>
              <div className="mt-1 inline-flex w-full flex-wrap rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900">
                {SENTIMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, sentiment: opt.id }))}
                    className={`min-h-[40px] flex-1 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
                      filters.sentiment === opt.id
                        ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100'
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={REPORT_LABEL_CLASSES}>Channel</label>
              <select
                value={filters.source}
                onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
                className={REPORT_FIELD_CLASSES}
              >
                <option value="all">All channels</option>
                {channels.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={REPORT_LABEL_CLASSES}>Product</label>
              <select
                value={filters.productKey}
                onChange={(e) => setFilters((f) => ({ ...f, productKey: e.target.value }))}
                className={REPORT_FIELD_CLASSES}
              >
                <option value="all">All products</option>
                {productOptions.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={REPORT_LABEL_CLASSES}>Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
                className={REPORT_FIELD_CLASSES}
              >
                <option value="all">All priorities</option>
                <option value="high">High priority</option>
              </select>
            </div>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => download('csv')}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#009750] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#007a42] disabled:opacity-60"
            >
              <FiDownload className="h-4 w-4" />
              {downloading?.startsWith('csv:') ? 'Preparing…' : 'Download report'}
            </button>

            <div className="flex flex-wrap gap-2">
              {(['csv', 'xlsx', 'pdf']).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  disabled={isBusy}
                  onClick={() => download(fmt)}
                  className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                >
                  {downloading?.startsWith(`${fmt}:`) ? '…' : formatLabel(fmt)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-7 dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Preview</h2>
            {previewLoading && (
              <span className="text-xs text-gray-500 dark:text-gray-400">Updating…</span>
            )}
          </div>

          <p className="mt-4 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            {previewLoading && !preview ? '—' : `${Number(total).toLocaleString()} feedback`}
          </p>

          <div className="mt-5 space-y-3">
            <SentimentBar label="Positive" pct={sentiment.positive_pct} color={SENTIMENT_COLORS.Positive} />
            <SentimentBar label="Neutral" pct={sentiment.neutral_pct} color={SENTIMENT_COLORS.Neutral} />
            <SentimentBar label="Negative" pct={sentiment.negative_pct} color={SENTIMENT_COLORS.Negative} />
          </div>

          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Sentiment trend
            </h3>
            <div className="mt-2 h-40 w-full">
              {trends.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-xl bg-gray-50 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  No trend data for this range
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatTrendTick}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={28}
                    />
                    <YAxis hide />
                    <Tooltip
                      labelFormatter={(v) => formatTrendTick(v)}
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #e5e7eb',
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#009750"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Top themes
            </h3>
            {themes.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No themes in this filter set.</p>
            ) : (
              <ol className="mt-2 space-y-2">
                {themes.map((theme, idx) => (
                  <li
                    key={`${theme.label}-${idx}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate text-gray-800 dark:text-gray-200">
                      <span className="mr-2 tabular-nums text-gray-400">{idx + 1}.</span>
                      {theme.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-gray-600 dark:text-gray-400">
                      {Number(theme.count).toLocaleString()}
                      <span className="text-gray-400"> ({theme.pct}%)</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>

      {/* Scheduled deliveries */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Scheduled deliveries</h2>
          <button
            type="button"
            onClick={() => setShowScheduleForm((v) => !v)}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            <FiPlus className="h-3.5 w-3.5" />
            {showScheduleForm ? 'Cancel' : 'Add schedule'}
          </button>
        </div>

        {showScheduleForm && (
          <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 md:grid-cols-2 dark:border-gray-800 dark:bg-gray-900/50">
            <div>
              <label className={REPORT_LABEL_CLASSES}>Name</label>
              <input
                value={scheduleForm.name}
                onChange={(e) => setScheduleForm((f) => ({ ...f, name: e.target.value }))}
                className={REPORT_FIELD_CLASSES}
              />
            </div>
            <div>
              <label className={REPORT_LABEL_CLASSES}>Cadence</label>
              <select
                value={scheduleForm.cadence}
                onChange={(e) => setScheduleForm((f) => ({ ...f, cadence: e.target.value }))}
                className={REPORT_FIELD_CLASSES}
              >
                {CADENCES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={REPORT_LABEL_CLASSES}>Time</label>
              <input
                type="time"
                value={scheduleForm.timeOfDay}
                onChange={(e) => setScheduleForm((f) => ({ ...f, timeOfDay: e.target.value }))}
                className={REPORT_FIELD_CLASSES}
              />
            </div>
            <div>
              <label className={REPORT_LABEL_CLASSES}>Format</label>
              <select
                value={scheduleForm.format}
                onChange={(e) => setScheduleForm((f) => ({ ...f, format: e.target.value }))}
                className={REPORT_FIELD_CLASSES}
              >
                <option value="csv">CSV</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={REPORT_LABEL_CLASSES}>Recipients (comma-separated)</label>
              <input
                value={scheduleForm.recipients}
                onChange={(e) => setScheduleForm((f) => ({ ...f, recipients: e.target.value }))}
                className={REPORT_FIELD_CLASSES}
                placeholder="cx@enterprise-life.com, ops@enterprise-life.com"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Uses your current report filters ({formatDisplayRange(filters.dateFrom, filters.dateTo)}).
              </p>
            </div>
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={createSchedule}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#009750] px-4 py-2 text-sm font-semibold text-white hover:bg-[#007a42]"
              >
                Save schedule
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
          {schedulesLoading ? (
            <p className="py-4 text-sm text-gray-500 dark:text-gray-400">Loading schedules…</p>
          ) : schedules.length === 0 ? (
            <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
              No scheduled deliveries yet. Add one to reuse this report on a cadence.
            </p>
          ) : (
            schedules.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {cadenceSummary(s)}
                    <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
                    {String(s.format || 'csv').toLowerCase()}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(s.enabled)}
                  aria-label={s.enabled ? 'Disable schedule' : 'Enable schedule'}
                  onClick={() => toggleSchedule(s)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    s.enabled ? 'bg-[#009750]' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      s.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setScheduleMenuId((id) => (id === s.id ? null : s.id))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                    aria-label="Schedule actions"
                  >
                    <FiMoreHorizontal className="h-4 w-4" />
                  </button>
                  {scheduleMenuId === s.id && (
                    <div className="absolute right-0 z-10 mt-1 w-36 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-950">
                      <button
                        type="button"
                        onClick={() => removeSchedule(s.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
