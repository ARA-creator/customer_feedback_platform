import { useEffect, useState } from 'react'
import SettingsSubpageShell from '../../shared/components/settings/SettingsSubpageShell'
import {
  clearArchivedFeedbackIds,
  getArchivedFeedbackCount,
  INBOX_PRIORITY_OPTIONS,
  INBOX_SENTIMENT_OPTIONS,
  loadInboxPreferences,
  saveInboxPreferences,
} from '../../shared/lib/inboxPreferences'

export default function SettingsInboxPage() {
  const [prefs, setPrefs] = useState(() => loadInboxPreferences())
  const [archivedCount, setArchivedCount] = useState(() => getArchivedFeedbackCount())
  const [clearMsg, setClearMsg] = useState(null)

  useEffect(() => {
    const refresh = () => setArchivedCount(getArchivedFeedbackCount())
    window.addEventListener('cfp-archived-feedback-cleared', refresh)
    return () => window.removeEventListener('cfp-archived-feedback-cleared', refresh)
  }, [])

  const update = (partial) => {
    const next = saveInboxPreferences(partial)
    setPrefs(next)
  }

  const handleClearArchive = () => {
    clearArchivedFeedbackIds()
    setArchivedCount(0)
    setClearMsg('Archived items cleared on this device.')
    window.setTimeout(() => setClearMsg(null), 4000)
  }

  return (
    <SettingsSubpageShell
      title="Inbox"
      description="Default filters and local inbox data on this device."
    >
      <div className="card p-6 space-y-5">
        <div>
          <label htmlFor="cfp-inbox-default-sentiment" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Default sentiment filter
          </label>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Applied when you open the inbox (unless a drill-down preset is active).
          </p>
          <select
            id="cfp-inbox-default-sentiment"
            value={prefs.defaultSentiment}
            onChange={(e) => update({ defaultSentiment: e.target.value })}
            className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009750]/30 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          >
            {INBOX_SENTIMENT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="cfp-inbox-default-priority" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Default priority filter
          </label>
          <select
            id="cfp-inbox-default-priority"
            value={prefs.defaultPriority}
            onChange={(e) => update({ defaultPriority: e.target.value })}
            className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009750]/30 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          >
            {INBOX_PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Archived feedback</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Archive state is stored locally in your browser ({archivedCount} item{archivedCount === 1 ? '' : 's'}).
        </p>
        {clearMsg && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
            {clearMsg}
          </p>
        )}
        <button
          type="button"
          onClick={handleClearArchive}
          disabled={archivedCount === 0}
          className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          Clear archived list
        </button>
      </div>
    </SettingsSubpageShell>
  )
}
