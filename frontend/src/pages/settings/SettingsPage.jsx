import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiChevronRight } from 'react-icons/fi'
import { getPreferences, savePreferences } from '../../features/notifications/services/notifications.api'

const PREF_META = [
  {
    key: 'new_feedback',
    label: 'New feedback',
    description: 'Notify when new feedback is ingested into the platform.',
  },
  {
    key: 'assigned_to_me',
    label: 'Assigned to me',
    description: 'Notify when feedback is assigned to you.',
  },
  {
    key: 'realtime',
    label: 'Live toast alerts',
    description: 'Show pop-up toasts when new notifications arrive while you are signed in.',
  },
  {
    key: 'anomaly_alerts',
    label: 'Sentiment spike alerts',
    description: 'Highlight unusual negative sentiment volume.',
  },
  {
    key: 'admin_user_events',
    label: 'Admin user changes',
    description: 'Notify when users are created, approved, or roles change.',
    adminOnly: true,
  },
]

export default function SettingsPage() {
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsError, setPrefsError] = useState(null)
  const [prefsSuccess, setPrefsSuccess] = useState(null)
  const [prefs, setPrefs] = useState({})

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setPrefsLoading(true)
      setPrefsError(null)
      try {
        const data = await getPreferences()
        if (mounted) setPrefs(data?.prefs || {})
      } catch (e) {
        if (mounted) setPrefsError(e?.response?.data?.error || e?.message || 'Failed to load notification preferences')
      } finally {
        if (mounted) setPrefsLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const visiblePrefRows = useMemo(() => {
    const keys = Object.keys(prefs || {})
    const hasAdminEvents = keys.includes('admin_user_events')
    return PREF_META.filter((row) => !row.adminOnly || hasAdminEvents)
  }, [prefs])

  const allDeliveryOff = useMemo(() => {
    const keys = visiblePrefRows.map((r) => r.key).filter((k) => k !== 'realtime')
    return keys.length > 0 && keys.every((k) => !prefs[k])
  }, [visiblePrefRows, prefs])

  const togglePref = (key) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const savePrefs = async () => {
    setPrefsSaving(true)
    setPrefsError(null)
    setPrefsSuccess(null)
    try {
      const res = await savePreferences(prefs)
      const saved = res?.prefs || prefs
      setPrefs(saved)
      setPrefsSuccess('Notification preferences saved.')
      try {
        window.dispatchEvent(new CustomEvent('cfp-notification-prefs-changed', { detail: { prefs: saved } }))
      } catch {
        // ignore
      }
    } catch (e) {
      setPrefsError(e?.response?.data?.error || e?.message || 'Failed to save preferences')
    } finally {
      setPrefsSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Notification preferences and account security.</p>
      </div>

      <div className="card overflow-hidden p-0">
        <Link
          to="/settings/security"
          className="flex min-h-[56px] items-center justify-between gap-4 px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-900/50"
        >
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Security</p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Password and sign-in</p>
          </div>
          <FiChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
        </Link>
      </div>

      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Notifications</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Choose which events create notifications for your account.
        </p>

        {prefsError && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
            {prefsError}
          </div>
        )}
        {prefsSuccess && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
            {prefsSuccess}
          </div>
        )}

        {prefsLoading ? (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading preferences…</p>
        ) : (
          <>
            {allDeliveryOff && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                All notification types are off. You will not receive new in-app notifications until you enable at least
                one option and save.
              </p>
            )}
            <ul className="mt-5 space-y-4">
              {visiblePrefRows.map((row) => (
                <li
                  key={row.key}
                  className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-800"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{row.label}</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{row.description}</p>
                  </div>
                  <label className="inline-flex shrink-0 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(prefs[row.key])}
                      onChange={() => togglePref(row.key)}
                      disabled={prefsSaving}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        <button
          type="button"
          onClick={savePrefs}
          disabled={prefsLoading || prefsSaving}
          className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#009750] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#007a42] disabled:opacity-60"
        >
          {prefsSaving ? 'Saving…' : 'Save notification preferences'}
        </button>
      </div>
    </div>
  )
}
