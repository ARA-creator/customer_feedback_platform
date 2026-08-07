import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts'
import InsightsSectionCard from './InsightsSectionCard'
import { fmtPct } from './insightsDeepFormat'
import { openFeedbackInInbox } from '../../utils/insightsInboxPreset'
import { humanizeSource } from '../../utils/insightsMetrics'
import { formatInsuranceTagChartLabel } from '../../utils/dashboardFormatters'

export default function QualityTextSection({
  quality,
  verbatim,
  csat,
  isDarkMode,
  loading,
  onNavigateToInbox,
  onSelectTheme,
  onSelectSource,
}) {
  const [q, setQ] = useState('')
  const tipStyle = {
    backgroundColor: isDarkMode ? '#0b1220' : '#ffffff',
    border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12,
  }

  const quotes = useMemo(() => {
    const rows = verbatim?.quotes || []
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(
      (r) =>
        String(r.text || '').toLowerCase().includes(needle) ||
        String(r.theme || '').toLowerCase().includes(needle),
    )
  }, [verbatim, q])

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-gray-50 dark:bg-gray-900/40" />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Override rate', fmtPct(quality?.override_rate), `${quality?.override_count || 0} corrected`],
          ['Pending review', fmtPct(quality?.review_pending_rate), `${quality?.review_pending_count || 0} pending`],
          ['Threat signals', quality?.threat_count ?? 0, 'Hostility / threat cues'],
          ['Sarcasm clash', quality?.sarcasm_clash_count ?? 0, 'Polarity clash flags'],
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-800">
            <p className="text-[10px] font-semibold uppercase text-gray-500">{label}</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
            <p className="text-[11px] text-gray-500">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InsightsSectionCard title="Sentiment score distribution" subtitle="Continuous compound scores (−1 to +1).">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quality?.score_histogram || []}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#1f2937' : '#e5e7eb'} vertical={false} />
                <XAxis dataKey="bin" tick={{ fontSize: 9, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} interval={1} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
                <Tooltip contentStyle={tipStyle} />
                <Bar dataKey="count" fill="#009750" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </InsightsSectionCard>

        <InsightsSectionCard title="CSAT / ratings" subtitle="From feedback rating field when present.">
          {(csat?.count || 0) === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">No ratings in this period.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Avg <span className="font-semibold text-gray-900 dark:text-gray-100">{csat.avg}</span> · n={csat.count}
              </p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={csat.distribution || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#1f2937' : '#e5e7eb'} vertical={false} />
                    <XAxis dataKey="rating" tick={{ fontSize: 11, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
                    <Tooltip contentStyle={tipStyle} />
                    <Bar dataKey="count" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={csat.trend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#1f2937' : '#e5e7eb'} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
                    <Tooltip contentStyle={tipStyle} />
                    <Line type="monotone" dataKey="avg" stroke="#009750" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </InsightsSectionCard>
      </div>

      <InsightsSectionCard
        title="Verbatim quote bank"
        subtitle="Searchable samples for exec packs, FAQ, and model training. Click Open to jump to inbox."
        right={
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter quotes…"
            className="w-44 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-950"
          />
        }
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(verbatim?.keywords || []).slice(0, 16).map((k) => (
            <button
              key={k.word}
              type="button"
              onClick={() => setQ(k.word)}
              className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              {k.word} · {k.count}
            </button>
          ))}
        </div>
        {quotes.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No quotes match.</p>
        ) : (
          <ul className="space-y-2">
            {quotes.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-gray-100 p-3 dark:border-gray-800"
              >
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  <span>{row.sentiment}</span>
                  <span>·</span>
                  <button type="button" className="hover:text-[#007a42]" onClick={() => onSelectTheme?.(row.theme)}>
                    {formatInsuranceTagChartLabel(row.theme)}
                  </button>
                  <span>·</span>
                  <button type="button" className="hover:text-[#007a42]" onClick={() => onSelectSource?.(row.channel)}>
                    {humanizeSource(row.channel)}
                  </button>
                  {row.threat ? <span className="rounded bg-rose-100 px-1.5 text-rose-700 dark:bg-rose-950 dark:text-rose-200">Threat</span> : null}
                  <button
                    type="button"
                    className="ml-auto text-[#007a42] hover:underline"
                    onClick={() => openFeedbackInInbox(row.id, onNavigateToInbox)}
                  >
                    Open #{row.id}
                  </button>
                  <button
                    type="button"
                    className="text-gray-500 hover:underline"
                    onClick={() => navigator.clipboard?.writeText(row.text || '')}
                  >
                    Copy
                  </button>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-800 dark:text-gray-200">{row.text}</p>
              </li>
            ))}
          </ul>
        )}
      </InsightsSectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InsightsSectionCard title="Override audit samples" subtitle="Officer sentiment corrections for QA / taxonomy work.">
          <SampleList
            rows={quality?.override_samples || []}
            render={(r) => `${r.previous || '?'} → ${r.sentiment}${r.note ? ` · ${r.note}` : ''}`}
            onNavigateToInbox={onNavigateToInbox}
          />
        </InsightsSectionCard>
        <InsightsSectionCard title="Threat / compliance samples" subtitle="Rows flagged by hostility / threat guards.">
          <SampleList
            rows={quality?.threat_samples || []}
            render={(r) => `${formatInsuranceTagChartLabel(r.theme)} · ${humanizeSource(r.channel)}`}
            onNavigateToInbox={onNavigateToInbox}
          />
        </InsightsSectionCard>
      </div>
    </div>
  )
}

function SampleList({ rows, render, onNavigateToInbox }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-gray-500">No samples.</p>
  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-xs">
          <span className="min-w-0 truncate text-gray-700 dark:text-gray-200">{render(r)}</span>
          <button
            type="button"
            className="shrink-0 font-semibold text-[#007a42] hover:underline"
            onClick={() => openFeedbackInInbox(r.id, onNavigateToInbox)}
          >
            #{r.id}
          </button>
        </li>
      ))}
    </ul>
  )
}
