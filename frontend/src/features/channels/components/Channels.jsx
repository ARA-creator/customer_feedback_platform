import { useCallback, useEffect, useRef, useState } from 'react'
import { FiCheckCircle, FiXCircle, FiRefreshCw } from 'react-icons/fi'
import { getChannelsStatus, triggerXPoll, updateChannelIngest } from '../services/channels.api'
import IntegrationsHealthSection from './IntegrationsHealthSection'

function StatusPill({ tone = 'off', label }) {
  const styles =
    tone === 'on'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
      : tone === 'pending'
        ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200'
        : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200'
  const Icon = tone === 'off' ? FiXCircle : FiCheckCircle
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

function IngestSwitch({ checked, disabled, onChange, label }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <span className="sr-only">{label}</span>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={`block h-6 w-11 rounded-full transition-colors ${
            checked ? 'bg-[#009750]' : 'bg-gray-300 dark:bg-gray-600'
          } ${disabled ? 'opacity-50' : ''}`}
          aria-hidden
        />
        <span
          className={`pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
          aria-hidden
        />
      </span>
      <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
        {checked ? 'On' : 'Off'}
      </span>
    </label>
  )
}

function channelTone({ enabled, configured }) {
  if (enabled) return 'on'
  if (configured) return 'pending'
  return 'off'
}

function channelLabel({ enabled, configured, name, autoPoll }) {
  if (enabled) return name
  if (configured) return `${name} (ready)`
  if (autoPoll) return `${name} (auto)`
  return name
}

function EnvCode({ children }) {
  return (
    <code className="rounded bg-white/80 px-1 dark:bg-black/30">{children}</code>
  )
}

/** Background status refresh — does not flash the UI. */
const STATUS_POLL_MS = 30_000

const CHANNEL_ROWS = [
  { label: 'WhatsApp (Twilio)', channelId: 'whatsapp_twilio' },
  { label: 'WhatsApp (Meta)', channelId: 'whatsapp_meta' },
  { label: 'Instagram (Meta)', channelId: 'instagram' },
  { label: 'Facebook (Meta)', channelId: 'facebook' },
  { label: 'Google Forms', channelId: 'google_forms' },
  { label: 'Email', channelId: 'email' },
  { label: 'Web', channelId: 'web' },
  { label: 'X', channelId: 'x' },
  { label: 'TikTok', channelId: 'tiktok' },
]

export default function Channels() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [savingChannel, setSavingChannel] = useState(null)
  const [toggleError, setToggleError] = useState(null)
  const [xPolling, setXPolling] = useState(false)
  const [xPollResult, setXPollResult] = useState(null)
  const [xPollError, setXPollError] = useState(null)
  const hasStatusRef = useRef(false)

  const load = useCallback(async ({ background = false, manual = false } = {}) => {
    const silent = background || (manual && hasStatusRef.current)
    if (manual && hasStatusRef.current) setRefreshing(true)
    else if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const data = await getChannelsStatus()
      setStatus(data)
      hasStatusRef.current = true
      if (silent) setError(null)
    } catch (e) {
      if (!silent) setError(e?.message || 'Failed to load channel status')
    } finally {
      if (manual && hasStatusRef.current) setRefreshing(false)
      else if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load({ background: false })
    const interval = setInterval(() => load({ background: true }), STATUS_POLL_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        load({ background: hasStatusRef.current })
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [load])

  const ingest = status?.ingest || {}
  const wa = status?.whatsapp_twilio
  const ig = status?.instagram
  const fb = status?.facebook
  const x = status?.x

  const isIngestOn = (channelId) => ingest[channelId] !== false

  const setChannelIngest = async (channelId, enabled) => {
    setSavingChannel(channelId)
    setToggleError(null)
    const prev = status?.ingest?.[channelId]
    setStatus((s) =>
      s ? { ...s, ingest: { ...(s.ingest || {}), [channelId]: enabled } } : s
    )
    try {
      const data = await updateChannelIngest({ [channelId]: enabled })
      setStatus((s) => (s ? { ...s, ingest: data.ingest || s.ingest } : s))
    } catch (e) {
      setStatus((s) =>
        s && prev !== undefined ? { ...s, ingest: { ...(s.ingest || {}), [channelId]: prev } } : s
      )
      setToggleError(e?.response?.data?.error || e?.message || 'Failed to update channel')
    } finally {
      setSavingChannel(null)
    }
  }

  const runXPoll = async () => {
    if (!isIngestOn('x')) {
      setXPollError('X ingest is turned off. Enable it under Channel ingest.')
      return
    }
    setXPolling(true)
    setXPollError(null)
    setXPollResult(null)
    try {
      const data = await triggerXPoll({ max_results: 25 })
      setXPollResult(data)
      await load({ background: true })
    } catch (e) {
      setXPollError(e?.response?.data?.error || e?.message || 'X poll failed')
    } finally {
      setXPolling(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Channels</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Connection status, ingest toggles, and ingestion health for all channels.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load({ manual: true })}
            disabled={refreshing}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
        </div>

        {loading && !status && (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">Loading status…</p>
        )}
        {error && !status && <p className="mt-4 text-sm text-rose-700 dark:text-rose-300">{error}</p>}

        {status && (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-950">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">
                Connection status
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill
                  tone={channelTone({ enabled: !!wa?.enabled, configured: !!wa?.configured })}
                  label={channelLabel({
                    enabled: !!wa?.enabled,
                    configured: !!wa?.configured,
                    name: 'WhatsApp',
                  })}
                />
                <StatusPill
                  tone={channelTone({ enabled: !!ig?.enabled, configured: !!ig?.configured })}
                  label={channelLabel({
                    enabled: !!ig?.enabled,
                    configured: !!ig?.configured,
                    name: 'Instagram',
                  })}
                />
                <StatusPill
                  tone={channelTone({ enabled: !!fb?.enabled, configured: !!fb?.configured })}
                  label={channelLabel({
                    enabled: !!fb?.enabled,
                    configured: !!fb?.configured,
                    name: 'Facebook',
                  })}
                />
                <StatusPill
                  tone={channelTone({ enabled: !!x?.enabled, configured: !!x?.configured })}
                  label={channelLabel({
                    enabled: !!x?.enabled,
                    configured: !!x?.configured,
                    name: 'X',
                    autoPoll: !!x?.auto_poll,
                  })}
                />
                <StatusPill tone={status?.google_forms?.enabled ? 'on' : 'off'} label="Google Forms" />
                <StatusPill tone={status?.email?.enabled ? 'on' : 'off'} label="Email" />
                <StatusPill tone={status?.web?.enabled ? 'on' : 'off'} label="Web" />
              </div>
            </div>

            {x?.configured && (
              <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">X — poll now</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      Fetches recent tweets matching your <EnvCode>X_QUERY</EnvCode> and ingests new items.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={runXPoll}
                    disabled={xPolling || !isIngestOn('x')}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#009750] bg-[#009750] px-4 py-2 text-sm font-semibold text-white hover:bg-[#007a42] disabled:opacity-60"
                  >
                    <FiRefreshCw className={`h-4 w-4 ${xPolling ? 'animate-spin' : ''}`} />
                    {xPolling ? 'Polling…' : 'Poll now'}
                  </button>
                </div>
                {xPollResult && (
                  <p className="mt-3 text-xs text-emerald-800 dark:text-emerald-200">
                    {xPollResult.message || 'Poll complete'}
                    {typeof xPollResult.processed === 'number' ? ` (${xPollResult.processed} new)` : ''}
                  </p>
                )}
                {xPollError && (
                  <p className="mt-3 text-xs text-rose-700 dark:text-rose-300">{xPollError}</p>
                )}
                {x.last_ingested_at && (
                  <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                    Last ingested: {new Date(x.last_ingested_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Channel ingest</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Pause or resume ingestion per channel. When off, new messages are not added to the inbox; existing webhooks
          still return successfully.
        </p>

        {toggleError && (
          <p className="mt-3 text-xs text-rose-700 dark:text-rose-300">{toggleError}</p>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2.5">Channel</th>
                <th className="px-4 py-2.5 text-right w-32">Ingest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {CHANNEL_ROWS.map((w) => {
                const on = isIngestOn(w.channelId)
                return (
                  <tr
                    key={w.channelId}
                    className={`bg-white dark:bg-gray-950 ${!on ? 'opacity-75' : ''}`}
                  >
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                      <span className="font-medium">{w.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <IngestSwitch
                        label={`${w.label} ingest`}
                        checked={on}
                        disabled={savingChannel === w.channelId}
                        onChange={(enabled) => setChannelIngest(w.channelId, enabled)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <IntegrationsHealthSection />
    </div>
  )
}
