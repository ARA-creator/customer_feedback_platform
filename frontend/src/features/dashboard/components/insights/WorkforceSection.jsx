import { Fragment, useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import InsightsSectionCard from './InsightsSectionCard'
import { fmtHours, fmtPct } from './insightsDeepFormat'
import { WORKING_DOW, WORKING_DOW_LABELS, WORKING_HOURS, WORKING_HOURS_LABEL } from '../../utils/workingHours'

function isAssignedKey(key) {
  const label = String(key || '').trim()
  return Boolean(label) && label.toLowerCase() !== 'unassigned'
}

export default function WorkforceSection({ data, isDarkMode, loading, onSelectAssignee }) {
  const [sortKey, setSortKey] = useState('count')
  const assignees = useMemo(() => {
    const rows = (data?.assignees || []).filter((r) => isAssignedKey(r?.key))
    rows.sort((a, b) => (Number(b[sortKey]) || 0) - (Number(a[sortKey]) || 0))
    return rows
  }, [data, sortKey])

  const teams = useMemo(
    () => (data?.teams || []).filter((r) => isAssignedKey(r?.key)),
    [data],
  )

  const mix = assignees.slice(0, 12).map((r) => ({
    key: r.key,
    open: r.open || 0,
    closed: r.closed || 0,
  }))

  const heat = data?.response_heatmap || []
  const maxH = Math.max(1, ...heat.map((c) => Number(c.count) || 0))

  const tipStyle = {
    backgroundColor: isDarkMode ? '#0b1220' : '#ffffff',
    border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12,
  }

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-gray-50 dark:bg-gray-900/40" />

  return (
    <div className="space-y-4">
      <InsightsSectionCard
        title="Assignee productivity"
        subtitle="Assigned officers only — volume, response times, open vs closed. Click a row to investigate."
        right={
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold dark:border-gray-700 dark:bg-gray-950"
          >
            <option value="count">Sort: volume</option>
            <option value="avg_response_hours">Sort: avg response</option>
            <option value="breach_rate">Sort: breach rate</option>
            <option value="open_share">Sort: open share</option>
          </select>
        }
      >
        {assignees.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No assigned officers in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-2 py-2">Assignee</th>
                  <th className="px-2 py-2">Volume</th>
                  <th className="px-2 py-2">Open / Closed</th>
                  <th className="px-2 py-2">Avg resp</th>
                  <th className="px-2 py-2">p50 / p90</th>
                  <th className="px-2 py-2">Breach</th>
                  <th className="px-2 py-2">Open share</th>
                </tr>
              </thead>
              <tbody>
                {assignees.map((r) => (
                  <tr
                    key={r.key}
                    className="cursor-pointer border-t border-gray-100 hover:bg-emerald-50/60 dark:border-gray-800 dark:hover:bg-emerald-950/20"
                    onClick={() => onSelectAssignee?.(r.key)}
                  >
                    <td className="px-2 py-2 font-semibold text-gray-900 dark:text-gray-100">{r.key}</td>
                    <td className="px-2 py-2">{r.count}</td>
                    <td className="px-2 py-2">{r.open} / {r.closed}</td>
                    <td className="px-2 py-2">{fmtHours(r.avg_response_hours)}</td>
                    <td className="px-2 py-2">{fmtHours(r.response_p50)} / {fmtHours(r.response_p90)}</td>
                    <td className="px-2 py-2">{fmtPct(r.breach_rate)}</td>
                    <td className="px-2 py-2">{fmtPct(r.open_share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </InsightsSectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InsightsSectionCard title="Open vs closed mix" subtitle="Top assigned officers by volume.">
          {mix.length === 0 ? (
            <p className="flex h-64 items-center justify-center text-sm text-gray-500">No assigned officers in this period.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mix} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#1f2937' : '#e5e7eb'} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
                  <YAxis type="category" dataKey="key" width={100} tick={{ fontSize: 9, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
                  <Tooltip contentStyle={tipStyle} />
                  <Legend />
                  <Bar dataKey="open" stackId="a" fill="#f59e0b" cursor="pointer" onClick={(d) => onSelectAssignee?.(d.key)} />
                  <Bar dataKey="closed" stackId="a" fill="#009750" cursor="pointer" onClick={(d) => onSelectAssignee?.(d.key)} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </InsightsSectionCard>

        <InsightsSectionCard
          title="Response hour heatmap"
          subtitle={`When first replies are sent during working hours (${WORKING_HOURS_LABEL}).`}
        >
          <div className="h-64 w-full">
            <div
              className="grid h-full w-full gap-1"
              style={{
                gridTemplateColumns: `2.25rem repeat(${WORKING_HOURS.length}, minmax(0, 1fr))`,
                gridTemplateRows: `auto repeat(${WORKING_DOW.length}, minmax(0, 1fr))`,
              }}
            >
              <div />
              {WORKING_HOURS.map((h) => (
                <div key={`h-${h}`} className="flex items-end justify-center pb-0.5 text-[9px] text-gray-400">
                  {h % 3 === 0 ? h : ''}
                </div>
              ))}
              {WORKING_DOW.map((dow, idx) => (
                <Fragment key={`row-${dow}`}>
                  <div className="flex items-center justify-end pr-1 text-[10px] font-medium text-gray-500">
                    {WORKING_DOW_LABELS[idx]}
                  </div>
                  {WORKING_HOURS.map((hour) => {
                    const cell = heat.find((c) => c.dow === dow && c.hour === hour)
                    const n = Number(cell?.count) || 0
                    const alpha = n ? 0.15 + (n / maxH) * 0.85 : 0
                    return (
                      <div
                        key={`${dow}-${hour}`}
                        title={`${WORKING_DOW_LABELS[idx]} ${hour}:00 — ${n}`}
                        className="min-h-0 rounded-sm border border-gray-100 dark:border-gray-800"
                        style={{ backgroundColor: n ? `rgba(0,151,80,${alpha})` : 'transparent' }}
                      />
                    )
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </InsightsSectionCard>
      </div>

      <InsightsSectionCard title="Team rollup" subtitle="Assigned teams only — volume and SLA health.">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-[10px] uppercase text-gray-500">
              <tr>
                <th className="px-2 py-2">Team</th>
                <th className="px-2 py-2">Volume</th>
                <th className="px-2 py-2">Open / Closed</th>
                <th className="px-2 py-2">Avg resp</th>
                <th className="px-2 py-2">Breach</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((r) => (
                <tr key={r.key} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-2 py-2 font-semibold">{r.key}</td>
                  <td className="px-2 py-2">{r.count}</td>
                  <td className="px-2 py-2">{r.open} / {r.closed}</td>
                  <td className="px-2 py-2">{fmtHours(r.avg_response_hours)}</td>
                  <td className="px-2 py-2">{fmtPct(r.breach_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {teams.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No assigned teams in this period.</p>
          ) : null}
        </div>
      </InsightsSectionCard>
    </div>
  )
}
