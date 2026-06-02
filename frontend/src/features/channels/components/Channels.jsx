import { useEffect, useState } from 'react'
import { FiCheckCircle, FiXCircle, FiRefreshCw, FiExternalLink } from 'react-icons/fi'
import { getIntegrationsWebhookBase, USE_DEV_API_PROXY } from '../../../shared/lib/apiClient'
import { getChannelsStatus, triggerXPoll, updateChannelIngest } from '../services/channels.api'

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

function SetupSteps({ title, children }) {
  return (
    <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/80 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="font-semibold">{title}</p>
      <ol className="mt-2 list-decimal list-inside space-y-1.5 text-xs leading-relaxed">{children}</ol>
    </div>
  )
}

function EnvCode({ children }) {
  return (
    <code className="rounded bg-white/80 px-1 dark:bg-black/30">{children}</code>
  )
}

const CHANNEL_ROWS = [
  { label: 'WhatsApp (Twilio)', path: '/integrations/whatsapp/twilio', method: 'POST', channelId: 'whatsapp_twilio' },
  { label: 'WhatsApp (Meta)', path: '/integrations/whatsapp/meta', method: 'POST', channelId: 'whatsapp_meta' },
  { label: 'Instagram (Meta)', path: '/integrations/instagram/webhook', method: 'GET/POST', channelId: 'instagram' },
  { label: 'Facebook (Meta)', path: '/integrations/facebook/webhook', method: 'GET/POST', channelId: 'facebook' },
  { label: 'Google Forms webhook', path: '/integrations/google/forms', method: 'POST', channelId: 'google_forms' },
  { label: 'Email poller', path: '/integrations/email/poll', method: 'POST', channelId: 'email' },
  { label: 'Web poller', path: '/integrations/web/poll', method: 'POST', channelId: 'web' },
  { label: 'X poll trigger', path: '/integrations/x/poll', method: 'POST', channelId: 'x' },
  { label: 'TikTok poll trigger', path: '/integrations/tiktok/poll', method: 'POST', channelId: 'tiktok' },
]

export default function Channels() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [savingChannel, setSavingChannel] = useState(null)
  const [toggleError, setToggleError] = useState(null)
  const [xPolling, setXPolling] = useState(false)
  const [xPollResult, setXPollResult] = useState(null)
  const [xPollError, setXPollError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getChannelsStatus()
      setStatus(data)
    } catch (e) {
      setError(e?.message || 'Failed to load channel status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    const onVis = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVis)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const integrationsBase = getIntegrationsWebhookBase()
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
      setXPollError('X ingest is turned off. Enable it in the table below.')
      return
    }
    setXPolling(true)
    setXPollError(null)
    setXPollResult(null)
    try {
      const data = await triggerXPoll({ max_results: 25 })
      setXPollResult(data)
      await load()
    } catch (e) {
      setXPollError(e?.response?.data?.error || e?.message || 'X poll failed')
    } finally {
      setXPolling(false)
    }
  }

  const metaNeedsSetup = ig && fb && !ig.enabled && !fb.enabled && !ig.configured

  return (
    <div className="p-6 space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Channels</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Connect Instagram, Facebook, and X to ingest customer feedback into the inbox.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <FiRefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {loading && <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">Loading status…</p>}
        {error && <p className="mt-4 text-sm text-rose-700 dark:text-rose-300">{error}</p>}

        {!loading && !error && status && (
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
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Green = messages ingested. Amber = credentials set, waiting for first message. Red = not configured.
                Use the ingest switches below to pause a channel without removing credentials.
              </p>

              {metaNeedsSetup && (
                <SetupSteps title="Connect Instagram &amp; Facebook (Meta)">
                  <li>
                    Create a Meta app with the <strong>Webhooks</strong> product in{' '}
                    <a
                      href="https://developers.facebook.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline"
                    >
                      Meta Developer Console
                    </a>
                    .
                  </li>
                  <li>
                    Set <EnvCode>META_VERIFY_TOKEN</EnvCode> and <EnvCode>META_APP_SECRET</EnvCode> in{' '}
                    <EnvCode>.env</EnvCode> (and Vercel env for production), then restart the backend.
                  </li>
                  <li>
                    Register callback URLs below for Instagram and Facebook (use the same verify token in Meta).
                  </li>
                  <li>
                    Subscribe to Page Messenger + feed (Facebook) and Instagram messages + comments. Send a test DM or
                    comment, then refresh this page. Full checklist: <EnvCode>docs/meta_webhooks_setup.md</EnvCode>.
                  </li>
                </SetupSteps>
              )}

              {x && !x.enabled && !x.configured && (
                <SetupSteps title="Connect X (Twitter)">
                  <li>
                    Create an app in the{' '}
                    <a
                      href="https://developer.x.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline"
                    >
                      X Developer Portal
                    </a>{' '}
                    with access to <strong>recent search</strong>.
                  </li>
                  <li>
                    Set <EnvCode>X_BEARER_TOKEN</EnvCode> and <EnvCode>X_QUERY</EnvCode> (e.g. your brand name or
                    handle) in <EnvCode>.env</EnvCode>.
                  </li>
                  <li>
                    Enable <EnvCode>X_POLL_ENABLED=true</EnvCode> for background polling, or use <strong>Poll now</strong>{' '}
                    below for a manual pull.
                  </li>
                </SetupSteps>
              )}

              {wa && !wa.enabled && (
                <SetupSteps title="Connect WhatsApp (Twilio)">
                  <li>
                    Set <EnvCode>TWILIO_ACCOUNT_SID</EnvCode>, <EnvCode>TWILIO_AUTH_TOKEN</EnvCode>, and optional{' '}
                    <EnvCode>TWILIO_WHATSAPP_TO_NUMBER</EnvCode> in <EnvCode>.env</EnvCode>.
                  </li>
                  <li>In Twilio Console, set the inbound webhook URL from the table below.</li>
                  <li>Send a test WhatsApp message, then refresh.</li>
                </SetupSteps>
              )}
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
          Turn a channel off to stop new messages from being ingested (webhooks still respond OK). Turn it on to resume.
          Callback URLs are shown for setup in Meta, Twilio, or cron.
        </p>
        <p className="mt-3 text-xs font-medium text-gray-700 dark:text-gray-300">
          Integrations base{' '}
          <span className="font-mono text-[11px] text-gray-600 dark:text-gray-400">
            ({USE_DEV_API_PROXY ? 'dev proxy' : import.meta.env.VITE_BACKEND_ORIGIN ? 'VITE_BACKEND_ORIGIN' : 'same-origin /api'})
          </span>
        </p>
        <p className="mt-1 break-all rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
          {integrationsBase}
        </p>

        {toggleError && (
          <p className="mt-3 text-xs text-rose-700 dark:text-rose-300">{toggleError}</p>
        )}

        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">URL</th>
                <th className="px-3 py-2 w-28">Ingest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {CHANNEL_ROWS.map((w) => {
                const full = `${integrationsBase}${w.path}`
                const on = isIngestOn(w.channelId)
                return (
                  <tr
                    key={w.path}
                    className={`bg-white dark:bg-gray-950 ${!on ? 'opacity-75' : ''}`}
                  >
                    <td className="px-3 py-2 align-top text-gray-900 dark:text-gray-100">
                      <span className="font-medium">{w.label}</span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {w.method}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <code className="break-all text-[11px] text-gray-700 dark:text-gray-300">{full}</code>
                    </td>
                    <td className="px-3 py-2 align-top">
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
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Instagram and Facebook use <strong className="font-medium">GET</strong> for Meta&apos;s verification handshake and{' '}
          <strong className="font-medium">POST</strong> for events. X uses polling only (no inbound webhook).
        </p>
        <a
          href="/admin/integrations"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#009750] hover:text-[#007a42] dark:text-emerald-400"
        >
          View integrations health
          <FiExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
    </div>
  )
}
