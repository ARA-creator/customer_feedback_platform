import { useEffect, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import InsightsSectionCard from './InsightsSectionCard'
import { fmtPct } from './insightsDeepFormat'
import { getInsightsReleaseImpact } from '../../services/dashboard.api'
import { openFeedbackInInbox } from '../../utils/insightsInboxPreset'

export default function ImpactRepeatsSection({
  impact,
  repeats,
  isDarkMode,
  loading,
  onNavigateToInbox,
}) {
  const releases = impact?.releases || []
  const [releaseId, setReleaseId] = useState(releases[0]?.id || '')
  const [windowDays, setWindowDays] = useState(7)
  const [impactData, setImpactData] = useState(impact?.latest || null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!releaseId) return undefined
    let cancelled = false
    ;(async () => {
      setBusy(true)
      setErr(null)
      try {
        const res = await getInsightsReleaseImpact({ release_id: releaseId, window_days: windowDays })
        if (!cancelled) setImpactData(res)
      } catch (e) {
        if (!cancelled) setErr(e?.response?.data?.error || e?.message || 'Failed to load impact')
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [releaseId, windowDays])

  const tipStyle = {
    backgroundColor: isDarkMode ? '#0b1220' : '#ffffff',
    border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12,
  }

  const beforeAfter = impactData
    ? [
        {
          period: 'Before',
          total: impactData.before?.total || 0,
          negative: impactData.before?.negative || 0,
          positive: impactData.before?.positive || 0,
        },
        {
          period: 'After',
          total: impactData.after?.total || 0,
          negative: impactData.after?.negative || 0,
          positive: impactData.after?.positive || 0,
        },
      ]
    : []

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-gray-50 dark:bg-gray-900/40" />

  return (
    <div className="space-y-4">
      <InsightsSectionCard
        title="Campaign / release impact"
        subtitle="Before vs after a release, outage, or promo event."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={releaseId}
              onChange={(e) => setReleaseId(e.target.value ? Number(e.target.value) : '')}
              className="max-w-[14rem] rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold dark:border-gray-700 dark:bg-gray-950"
            >
              <option value="">Select release…</option>
              {releases.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
            <select
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold dark:border-gray-700 dark:bg-gray-950"
            >
              {[3, 7, 14, 30].map((d) => (
                <option key={d} value={d}>
                  ±{d}d
                </option>
              ))}
            </select>
          </div>
        }
      >
        {releases.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            No release events yet. Admins can add them under integrations / releases.
          </p>
        ) : busy ? (
          <div className="h-48 animate-pulse rounded-xl bg-gray-50 dark:bg-gray-900/40" />
        ) : err ? (
          <p className="py-6 text-center text-sm text-rose-600">{err}</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <p className="text-[10px] uppercase text-gray-500">Before neg share</p>
                <p className="text-lg font-semibold">{fmtPct(impactData?.before?.negative_share)}</p>
              </div>
              <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <p className="text-[10px] uppercase text-gray-500">After neg share</p>
                <p className="text-lg font-semibold">{fmtPct(impactData?.after?.negative_share)}</p>
              </div>
              <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <p className="text-[10px] uppercase text-gray-500">Before volume</p>
                <p className="text-lg font-semibold">{impactData?.before?.total ?? 0}</p>
              </div>
              <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <p className="text-[10px] uppercase text-gray-500">After volume</p>
                <p className="text-lg font-semibold">{impactData?.after?.total ?? 0}</p>
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={beforeAfter}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#1f2937' : '#e5e7eb'} vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
                  <Tooltip contentStyle={tipStyle} />
                  <Legend />
                  <Bar dataKey="total" fill="#94a3b8" />
                  <Bar dataKey="negative" fill="#e11d48" />
                  <Bar dataKey="positive" fill="#009750" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </InsightsSectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InsightsSectionCard
          title="Repeat customers"
          subtitle={`Chronic ≥ ${repeats?.chronic_threshold || 3} messages in window.`}
        >
          <RepeatTable rows={repeats?.customers || []} onNavigateToInbox={onNavigateToInbox} />
        </InsightsSectionCard>
        <InsightsSectionCard title="Repeat policies" subtitle="Same policy across multiple feedback rows.">
          <RepeatTable rows={repeats?.policies || []} onNavigateToInbox={onNavigateToInbox} />
        </InsightsSectionCard>
      </div>
    </div>
  )
}

function RepeatTable({ rows, onNavigateToInbox }) {
  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-gray-500">No repeats detected in this period.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead className="text-[10px] uppercase text-gray-500">
          <tr>
            <th className="px-2 py-2">Key</th>
            <th className="px-2 py-2">Count</th>
            <th className="px-2 py-2">Neg share</th>
            <th className="px-2 py-2">Flag</th>
            <th className="px-2 py-2">Open</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.kind}-${r.key}`} className="border-t border-gray-100 dark:border-gray-800">
              <td className="max-w-[12rem] truncate px-2 py-2 font-semibold" title={r.label || r.key}>
                {r.label || r.key}
              </td>
              <td className="px-2 py-2">{r.count}</td>
              <td className="px-2 py-2">{fmtPct(r.negative_share)}</td>
              <td className="px-2 py-2">{r.chronic ? 'Chronic' : 'Repeat'}</td>
              <td className="px-2 py-2">
                <button
                  type="button"
                  className="text-[#007a42] hover:underline"
                  onClick={() => openFeedbackInInbox(r.feedback_ids?.[0], onNavigateToInbox)}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
