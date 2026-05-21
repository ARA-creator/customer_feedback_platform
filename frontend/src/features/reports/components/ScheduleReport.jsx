import { useEffect, useMemo, useState } from 'react'
import { FiArrowLeft, FiPlus, FiTrash2 } from 'react-icons/fi'
import { createReportSchedule, deleteReportSchedule, listReportSchedules } from '../services/reports.api'

const CADENCES = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
]

export default function ScheduleReport({ onBack, embedded = false }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [schedules, setSchedules] = useState([])

  const [name, setName] = useState('Weekly summary')
  const [cadence, setCadence] = useState('weekly')
  const [timeOfDay, setTimeOfDay] = useState('08:00')
  const [timezone, setTimezone] = useState('UTC')
  const [recipients, setRecipients] = useState('')
  const [format, setFormat] = useState('csv')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listReportSchedules()
      setSchedules(data?.schedules || [])
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load schedules')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const canCreate = useMemo(() => {
    const recips = recipients
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    return name.trim().length >= 3 && recips.length > 0
  }, [name, recipients])

  const create = async () => {
    setError(null)
    try {
      await createReportSchedule({
        name: name.trim(),
        cadence,
        time_of_day: timeOfDay,
        timezone,
        recipients: recipients
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        format,
        enabled: true,
        filters: {},
      })
      setRecipients('')
      await load()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to create schedule')
    }
  }

  const remove = async (id) => {
    setError(null)
    try {
      await deleteReportSchedule(id)
      await load()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to delete schedule')
    }
  }

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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Schedule report</h1>
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Save report schedules. Delivery automation can be connected later (email/Slack).
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
        <h2 className="text-sm font-semibold text-gray-900">Create schedule</h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder="Weekly summary"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Cadence</label>
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              {CADENCES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Time</label>
            <input
              type="time"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Timezone</label>
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder="UTC"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-600">Recipients (comma-separated)</label>
            <input
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder="cx@enterprise-life.com, ops@enterprise-life.com"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={create}
              disabled={!canCreate}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#009750] px-4 py-2 text-sm font-semibold text-white hover:bg-[#007a42] disabled:opacity-60"
            >
              <FiPlus className="h-4 w-4" />
              Create schedule
            </button>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-900">Saved schedules</h2>
        {loading ? (
          <p className="mt-3 text-sm text-gray-600">Loading…</p>
        ) : schedules.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">No schedules yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {schedules.map((s) => (
              <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {String(s.cadence).toUpperCase()} · {s.time_of_day || '—'} {s.timezone || 'UTC'} · {s.format?.toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 break-all">
                    Recipients: {(s.recipients || []).join(', ') || '—'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <FiTrash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

