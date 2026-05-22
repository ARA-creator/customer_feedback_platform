import { useEffect, useState } from 'react'
import { FiCheckCircle, FiCopy, FiXCircle, FiRefreshCw } from 'react-icons/fi'
import {
  getClipboardBackendOrigin,
  getIntegrationsWebhookBase,
  USE_DEV_API_PROXY,
} from '../../../shared/lib/apiClient'
import { getChannelsStatus } from '../services/channels.api'

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

function channelTone({ enabled, configured }) {
  if (enabled) return 'on'
  if (configured) return 'pending'
  return 'off'
}

export default function Channels() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copiedPath, setCopiedPath] = useState(null)

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

  const publicBase = getClipboardBackendOrigin()
  const integrationsBase = getIntegrationsWebhookBase()
  const wa = status?.whatsapp_twilio

  const webhooks = [
    { label: 'WhatsApp (Twilio)', path: '/integrations/whatsapp/twilio', key: 'whatsapp_twilio', method: 'POST' },
    { label: 'WhatsApp (Meta)', path: '/integrations/whatsapp/meta', key: 'whatsapp_twilio', method: 'POST' },
    // Note: IG/FB GET is a verification challenge; opening in browser without params will 403.
    { label: 'Instagram (Meta)', path: '/integrations/instagram/webhook', key: 'meta', method: 'GET/POST' },
    { label: 'Facebook (Meta)', path: '/integrations/facebook/webhook', key: 'meta', method: 'GET/POST' },
    { label: 'Google Forms webhook', path: '/integrations/google/forms', key: 'google_forms', method: 'POST' },
    { label: 'Email poller', path: '/integrations/email/poll', key: 'email', method: 'POST' },
    { label: 'Web poller', path: '/integrations/web/poll', key: 'web', method: 'POST' },
    { label: 'X poll trigger', path: '/integrations/x/poll', key: 'x', method: 'POST' },
    { label: 'TikTok poll trigger', path: '/integrations/tiktok/poll', key: 'tiktok', method: 'POST' },
  ]

  const copyUrl = async (path) => {
    const url = `${publicBase}${path}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedPath(path)
      setTimeout(() => setCopiedPath((p) => (p === path ? null : p)), 2000)
    } catch {
      window.prompt('Copy this URL:', url)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Channels</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Connection health and webhook / poller URLs for your integrations.
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
        {error && (
          <p className="mt-4 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </p>
        )}

        {!loading && !error && status && (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-950">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">
                Connection status
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill
                  tone={channelTone({
                    enabled: !!wa?.enabled,
                    configured: !!wa?.configured,
                  })}
                  label={
                    wa?.enabled ? 'WhatsApp' : wa?.configured ? 'WhatsApp (ready)' : 'WhatsApp'
                  }
                />
                <StatusPill tone={status?.meta?.enabled ? 'on' : 'off'} label="Meta (FB/IG)" />
                <StatusPill
                  tone={status?.x?.enabled ? 'on' : 'off'}
                  label={status?.x?.auto_poll ? 'X (auto)' : 'X'}
                />
                <StatusPill
                  tone={status?.tiktok?.enabled ? 'on' : 'off'}
                  label={status?.tiktok?.auto_poll ? 'TikTok (auto)' : 'TikTok'}
                />
                <StatusPill tone={status?.google_forms?.enabled ? 'on' : 'off'} label="Google Forms" />
                <StatusPill tone={status?.email?.enabled ? 'on' : 'off'} label="Email" />
                <StatusPill tone={status?.web?.enabled ? 'on' : 'off'} label="Web" />
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Green = messages ingested. Amber = Twilio credentials set but no WhatsApp messages in the inbox yet.
                Red = not configured or never received.
              </p>
              {wa && !wa.enabled && (
                <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/80 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                  <p className="font-semibold">Connect WhatsApp (Twilio)</p>
                  <ol className="mt-2 list-decimal list-inside space-y-1.5 text-xs leading-relaxed">
                    <li>
                      Set <code className="rounded bg-white/80 px-1 dark:bg-black/30">TWILIO_ACCOUNT_SID</code>,{' '}
                      <code className="rounded bg-white/80 px-1 dark:bg-black/30">TWILIO_AUTH_TOKEN</code>, and
                      optional{' '}
                      <code className="rounded bg-white/80 px-1 dark:bg-black/30">TWILIO_WHATSAPP_TO_NUMBER</code>{' '}
                      in <code className="rounded bg-white/80 px-1 dark:bg-black/30">.env</code> (and Vercel env for
                      production).
                    </li>
                    <li>
                      In Twilio Console → WhatsApp sandbox or your sender → set the inbound webhook URL below (must
                      include <code className="rounded bg-white/80 px-1 dark:bg-black/30">/api</code> on Vercel).
                    </li>
                    <li>Send a test WhatsApp message to your Twilio number, then refresh this page.</li>
                  </ol>
                  {!wa.configured && (
                    <p className="mt-2 text-xs font-medium">
                      Twilio credentials are not loaded on this server yet — restart the backend after updating{' '}
                      <code className="rounded bg-white/80 px-1 dark:bg-black/30">.env</code>.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Webhook &amp; poller connection</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Paste the full webhook URL into Twilio, Meta, or Google Apps Script. On{' '}
          <strong className="font-medium">Vercel production</strong>, integration routes are under{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px] dark:bg-gray-800">/api/integrations/...</code>.
          Local dev uses the integrations base below (Vite proxies to Flask).
        </p>
        <p className="mt-3 text-xs font-medium text-gray-700 dark:text-gray-300">
          Integrations webhook base{' '}
          <span className="font-mono text-[11px] text-gray-600 dark:text-gray-400">
            ({USE_DEV_API_PROXY ? 'dev proxy' : import.meta.env.VITE_BACKEND_ORIGIN ? 'VITE_BACKEND_ORIGIN' : 'same-origin /api'})
          </span>
        </p>
        <p className="mt-1 break-all rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
          {integrationsBase}
        </p>

        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">URL</th>
                <th className="px-3 py-2 w-24"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {webhooks.map((w) => {
                const full = `${integrationsBase}${w.path}`
                return (
                  <tr key={w.path} className="bg-white dark:bg-gray-950">
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
                      <button
                        type="button"
                        onClick={() => copyUrl(w.path)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <FiCopy className="h-3.5 w-3.5" />
                        {copiedPath === w.path ? 'Copied' : 'Copy'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Meta Instagram/Facebook webhooks use <strong className="font-medium">GET</strong> for the verification
          handshake and <strong className="font-medium">POST</strong> for events — configure both in Meta Developer
          Console.
        </p>
      </div>
    </div>
  )
}

