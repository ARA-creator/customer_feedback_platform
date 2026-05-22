import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiChevronRight } from 'react-icons/fi'
import { getChannelsStatus } from '../../../features/channels/services/channels.api'
import { INTEGRATION_CHANNEL_ROWS } from '../settingsConfig'

function statusLabel(row, data) {
  if (!data) return { tone: 'off', text: 'Unknown' }
  if (row.statusPath === 'whatsapp_twilio') {
    const wa = data.whatsapp_twilio || {}
    if (wa.enabled) return { tone: 'on', text: 'Receiving' }
    if (wa.configured) return { tone: 'pending', text: 'Configured' }
    return { tone: 'off', text: 'Not set up' }
  }
  const block = data[row.statusPath]
  if (!block) return { tone: 'off', text: 'Not set up' }
  if (block.enabled) return { tone: 'on', text: 'Receiving' }
  if (block.configured) return { tone: 'pending', text: 'Configured' }
  return { tone: 'off', text: 'Not set up' }
}

function StatusDot({ tone }) {
  const colors =
    tone === 'on'
      ? 'bg-emerald-500'
      : tone === 'pending'
        ? 'bg-amber-400'
        : 'bg-gray-300 dark:bg-gray-600'
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${colors}`} aria-hidden />
}

export default function SettingsIntegrationsSummary() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getChannelsStatus()
        if (mounted) setStatus(data)
      } catch (e) {
        if (mounted) setError(e?.response?.data?.error || e?.message || 'Could not load channels')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Connected channels</h2>
        <Link
          to="/admin/channels"
          className="text-xs font-medium text-[#009750] hover:text-[#007a42] dark:text-emerald-400"
        >
          Manage all
        </Link>
      </div>
      {loading && <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Loading…</p>}
      {error && (
        <p className="mt-3 text-xs text-rose-700 dark:text-rose-300">{error}</p>
      )}
      {!loading && !error && (
        <ul className="mt-3 space-y-2">
          {INTEGRATION_CHANNEL_ROWS.map((row) => {
            const st = statusLabel(row, status)
            return (
              <li
                key={row.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
              >
                <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{row.label}</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  <StatusDot tone={st.tone} />
                  {st.text}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <Link
        to="/admin/integrations"
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        Integrations health
        <FiChevronRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  )
}
