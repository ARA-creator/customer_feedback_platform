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
  Legend,
} from 'recharts'
import InsightsSectionCard from './InsightsSectionCard'
import { fmtHours, fmtPct } from './insightsDeepFormat'
import { humanizeSource } from '../../utils/insightsMetrics'
import { formatInsuranceTagChartLabel } from '../../utils/dashboardFormatters'

function Kpi({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-800 dark:bg-gray-950">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      {sub ? <p className="text-[11px] text-gray-500 dark:text-gray-400">{sub}</p> : null}
    </div>
  )
}

export default function OpsSlaSection({
  data,
  escalations,
  isDarkMode,
  loading,
  onSelectTheme,
  onSelectSource,
  onSelectAssignee,
}) {
  const [dim, setDim] = useState('channel') // channel | theme | assignee
  const ops = data || {}
  const esc = escalations || {}

  const breakdown = useMemo(() => {
    if (dim === 'theme') return ops.by_theme || []
    if (dim === 'assignee') return ops.by_assignee || []
    return ops.by_channel || []
  }, [dim, ops])

  const chartRows = breakdown.map((r) => ({
    key: r.key,
    label:
      dim === 'channel'
        ? humanizeSource(r.key)
        : dim === 'theme'
          ? formatInsuranceTagChartLabel(r.key)
          : r.key,
    count: r.count,
    breach_rate: Math.round((Number(r.breach_rate) || 0) * 1000) / 10,
    response_p50: r.response_p50,
    response_p90: r.response_p90,
  }))

  const tipStyle = {
    backgroundColor: isDarkMode ? '#0b1220' : '#ffffff',
    border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12,
  }

  const onBarClick = (row) => {
    if (!row?.key) return
    if (dim === 'channel') onSelectSource?.(row.key)
    else if (dim === 'theme') onSelectTheme?.(row.key)
    else onSelectAssignee?.(row.key)
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-gray-50 dark:bg-gray-900/40" />
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Kpi label="Response p50" value={fmtHours(ops.response?.p50)} sub={`n=${ops.response?.count || 0}`} />
        <Kpi label="Response p90" value={fmtHours(ops.response?.p90)} />
        <Kpi label="Resolution p50" value={fmtHours(ops.resolution?.p50)} sub={`n=${ops.resolution?.count || 0}`} />
        <Kpi label="Resolution p90" value={fmtHours(ops.resolution?.p90)} />
        <Kpi label="SLA breach rate" value={fmtPct(ops.breach_rate)} sub={`${ops.breach_count || 0} breached`} />
        <Kpi label="Open backlog" value={ops.open_count ?? 0} sub="Aging below" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InsightsSectionCard
          title="First-response distribution"
          subtitle="Hours to first reply (in-app send, email, WhatsApp, or marked replied)."
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ops.response?.histogram || []}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#1f2937' : '#e5e7eb'} vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
                <Tooltip contentStyle={tipStyle} />
                <Bar dataKey="count" fill="#009750" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </InsightsSectionCard>

        <InsightsSectionCard
          title="Resolution distribution"
          subtitle="Hours from created to closed/resolved or marked replied."
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ops.resolution?.histogram || []}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#1f2937' : '#e5e7eb'} vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
                <Tooltip contentStyle={tipStyle} />
                <Bar dataKey="count" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </InsightsSectionCard>
      </div>

      <InsightsSectionCard
        title="Backlog aging"
        subtitle="Open items by age since received."
      >
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ops.backlog_aging || []}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#1f2937' : '#e5e7eb'} vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </InsightsSectionCard>

      <InsightsSectionCard
        title="SLA by dimension"
        subtitle="Click a bar to investigate that channel, theme, or assignee."
        right={
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
            {['channel', 'theme', 'assignee'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDim(d)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize ${
                  dim === d ? 'bg-[#009750] text-white' : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        }
      >
        {chartRows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">No breakdown data for this period.</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartRows}
                layout="vertical"
                margin={{ left: 8, right: 12 }}
                onClick={(state) => onBarClick(state?.activePayload?.[0]?.payload)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#1f2937' : '#e5e7eb'} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={110}
                  tick={{ fontSize: 10, fill: isDarkMode ? '#cbd5e1' : '#64748b' }}
                />
                <Tooltip contentStyle={tipStyle} />
                <Legend />
                <Bar dataKey="count" name="Volume" fill="#64748b" radius={[0, 6, 6, 0]} cursor="pointer" />
                <Bar dataKey="breach_rate" name="Breach %" fill="#e11d48" radius={[0, 6, 6, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </InsightsSectionCard>

      <InsightsSectionCard title="Escalation rate over time" subtitle={`Overall ${fmtPct(esc.rate)} (${esc.count || 0} escalated).`}>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={esc.over_time || []}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#1f2937' : '#e5e7eb'} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
              <Tooltip contentStyle={tipStyle} />
              <Legend />
              <Line type="monotone" dataKey="escalated" name="Escalated" stroke="#e11d48" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="total" name="Total" stroke="#94a3b8" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </InsightsSectionCard>
    </div>
  )
}
