import { useEffect, useMemo, useState } from 'react'
import { FiDatabase, FiRefreshCw, FiSave } from 'react-icons/fi'
import { adminGetRetentionConfig, adminSetRetentionConfig } from '../services/admin.api'

export default function AdminRetention() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [raw, setRaw] = useState('')

  const parsed = useMemo(() => {
    try {
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [raw])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminGetRetentionConfig()
      setRaw(JSON.stringify(data?.config || {}, null, 2))
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load retention config')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      if (!parsed || typeof parsed !== 'object') {
        setError('Config must be valid JSON.')
        return
      }
      await adminSetRetentionConfig(parsed)
      await load()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to save retention config')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200">
            <FiDatabase className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Export & retention</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Basic data retention and export settings (v1).</p>
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
            <button
              type="button"
              disabled={saving || !raw}
              onClick={save}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#009750] px-3 py-2 text-xs font-semibold text-white hover:bg-[#007a42] disabled:opacity-60"
            >
              <FiSave className="h-4 w-4" />
              Save
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
          <div className="mt-6">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Config JSON</label>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={14}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/40 focus:border-[#009750]/40 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
            />
            {!parsed && (
              <p className="mt-2 text-xs text-rose-700 dark:text-rose-200">Invalid JSON (cannot save).</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

