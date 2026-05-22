import { useEffect, useMemo, useState } from 'react'
import { getPreferences, savePreferences } from '../../features/notifications/services/notifications.api'
import SettingsSubpageShell from '../../shared/components/settings/SettingsSubpageShell'
import {
  loadNotificationUiPrefs,
  saveNotificationUiPrefs,
} from '../../shared/lib/notificationUiPreferences'

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

export default function SettingsNotificationsPage() {
  const [uiPrefs, setUiPrefs] = useState(() => loadNotificationUiPrefs())
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsError, setPrefsError] = useState(null)
  const [prefsSuccess, setPrefsSuccess] = useState(null)
  const [prefs, setPrefs] = useState({})

  const updateUi = (partial) => {
    setUiPrefs(saveNotificationUiPrefs(partial))
  }

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
    <SettingsSubpageShell
      title="Notifications"
      description="In-app notification types and quiet hours on this device."
    >
      <div className="card p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Quiet hours</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Suppress live toast alerts during the window below (local time). Saved automatically.
        </p>
        <label className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-800 cursor-pointer">
          <div>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Enable quiet hours</span>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">No pop-up toasts during this period.</p>
          </div>
          <input
            type="checkbox"
            checked={uiPrefs.quietHoursEnabled}
            onChange={(e) => updateUi({ quietHoursEnabled: e.target.checked })}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cfp-quiet-start" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              From
            </label>
            <input
              id="cfp-quiet-start"
              type="time"
              value={uiPrefs.quietStart}
              onChange={(e) => updateUi({ quietStart: e.target.value })}
              disabled={!uiPrefs.quietHoursEnabled}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="cfp-quiet-end" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Until
            </label>
            <input
              id="cfp-quiet-end"
              type="time"
              value={uiPrefs.quietEnd}
              onChange={(e) => updateUi({ quietEnd: e.target.value })}
              disabled={!uiPrefs.quietHoursEnabled}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Notification types</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Choose which events create in-app notifications for your account.
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
    </SettingsSubpageShell>
  )
}
