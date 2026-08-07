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
  AreaChart,
  Area,
} from 'recharts'
import InsightsSectionCard from './InsightsSectionCard'
import { fmtPct } from './insightsDeepFormat'
import { formatInsuranceTagChartLabel } from '../../utils/dashboardFormatters'
import { humanizeSource } from '../../utils/insightsMetrics'
import { CHART_PALETTE } from '../../constants/palette'

export default function DriversSegmentsSection({
  drivers,
  segments,
  productLob,
  channelMix,
  crossTabs,
  isDarkMode,
  loading,
  onSelectTheme,
  onSelectSource,
}) {
  const [cubeA, setCubeA] = useState('channel_theme')
  const tipStyle = {
    backgroundColor: isDarkMode ? '#0b1220' : '#ffffff',
    border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12,
  }

  const driverRows = (drivers || []).map((d) => ({
    ...d,
    label: formatInsuranceTagChartLabel(d.theme),
    liftPct: Math.round((Number(d.lift) || 0) * 100) / 100,
    negSharePct: Math.round((Number(d.neg_share_of_negatives) || 0) * 1000) / 10,
  }))

  const segDetail = segments?.detail || []

  const mixPeriods = channelMix?.periods || []
  const mixChannels = channelMix?.channels || []

  const productHeat = useMemo(() => {
    const rows = productLob || []
    const products = [...new Set(rows.map((r) => r.product))].slice(0, 8)
    const themes = [...new Set(rows.map((r) => r.theme))].slice(0, 8)
    const max = Math.max(1, ...rows.map((r) => Number(r.total) || 0))
    return { products, themes, rows, max }
  }, [productLob])

  const cube = crossTabs?.[cubeA] || []
  const cubePivot = useMemo(() => {
    const aKeys = [...new Set(cube.map((c) => c.a))].slice(0, 8)
    const bKeys = [...new Set(cube.map((c) => c.b))].slice(0, 10)
    const map = new Map(cube.map((c) => [`${c.a}||${c.b}`, c.count]))
    return { aKeys, bKeys, map }
  }, [cube])

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-gray-50 dark:bg-gray-900/40" />

  return (
    <div className="space-y-4">
      <InsightsSectionCard
        title="Negative volume drivers"
        subtitle="Themes that contribute most to negatives (lift vs overall share). Click to investigate."
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={driverRows}
              layout="vertical"
              margin={{ left: 8 }}
              onClick={(s) => {
                const theme = s?.activePayload?.[0]?.payload?.theme
                if (theme) onSelectTheme?.(theme)
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#1f2937' : '#e5e7eb'} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
              <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 10, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
              <Tooltip contentStyle={tipStyle} />
              <Legend />
              <Bar dataKey="negSharePct" name="% of negatives" fill="#e11d48" cursor="pointer" />
              <Bar dataKey="liftPct" name="Lift" fill="#f59e0b" cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </InsightsSectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InsightsSectionCard title="Customer segments" subtitle="Volume and sentiment by segment / tier.">
          {segDetail.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No segment metadata in this period.</p>
          ) : (
            <ul className="space-y-2">
              {segDetail.map((s) => {
                const t = Math.max(1, s.count)
                return (
                  <li key={s.segment} className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.segment}</p>
                      <p className="text-xs text-gray-500">{s.count}</p>
                    </div>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-900">
                      <div className="bg-emerald-500" style={{ width: `${(s.positive / t) * 100}%` }} />
                      <div className="bg-slate-400" style={{ width: `${(s.neutral / t) * 100}%` }} />
                      <div className="bg-rose-500" style={{ width: `${(s.negative / t) * 100}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">
                      Top themes:{' '}
                      {(s.top_themes || []).map((x) => formatInsuranceTagChartLabel(x.theme)).join(', ') || '—'}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </InsightsSectionCard>

        <InsightsSectionCard
          title="Channel mix shifts"
          subtitle={`${channelMix?.granularity === 'month' ? 'Monthly' : 'Quarterly'} share by channel.`}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mixPeriods}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#1f2937' : '#e5e7eb'} vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: isDarkMode ? '#cbd5e1' : '#64748b' }} />
                <Tooltip contentStyle={tipStyle} />
                <Legend formatter={(v) => humanizeSource(v)} />
                {mixChannels.slice(0, 6).map((ch, i) => (
                  <Area
                    key={ch}
                    type="monotone"
                    dataKey={ch}
                    stackId="1"
                    stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                    fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                    fillOpacity={0.55}
                    onClick={() => onSelectSource?.(ch)}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </InsightsSectionCard>
      </div>

      <InsightsSectionCard title="Product × theme" subtitle="Heatmap of volume (primary product match). Click a cell theme to investigate.">
        {productHeat.products.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No product-linked feedback in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px]">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left text-gray-500">Product</th>
                  {productHeat.themes.map((t) => (
                    <th key={t} className="px-1 py-1 font-medium text-gray-500">
                      {formatInsuranceTagChartLabel(t)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productHeat.products.map((p) => (
                  <tr key={p}>
                    <td className="px-2 py-1 font-semibold text-gray-800 dark:text-gray-100">{p}</td>
                    {productHeat.themes.map((t) => {
                      const cell = productHeat.rows.find((r) => r.product === p && r.theme === t)
                      const n = Number(cell?.total) || 0
                      const neg = Number(cell?.negative) || 0
                      const alpha = n ? 0.12 + (n / productHeat.max) * 0.75 : 0
                      return (
                        <td key={`${p}-${t}`} className="px-1 py-1">
                          <button
                            type="button"
                            disabled={!n}
                            onClick={() => onSelectTheme?.(t)}
                            className="flex h-9 w-full min-w-[3.5rem] flex-col items-center justify-center rounded-md border border-gray-100 disabled:opacity-40 dark:border-gray-800"
                            style={{ backgroundColor: n ? `rgba(0,151,80,${alpha})` : 'transparent' }}
                            title={`${p} × ${t}: ${n} (${neg} neg)`}
                          >
                            <span className="font-semibold">{n || ''}</span>
                            {neg ? <span className="text-[9px] text-rose-700 dark:text-rose-300">{neg}−</span> : null}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </InsightsSectionCard>

      <InsightsSectionCard
        title="Cross-tab explorer"
        subtitle="Bounded pivot of channel × theme × status × week × assignee."
        right={
          <select
            value={cubeA}
            onChange={(e) => setCubeA(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold dark:border-gray-700 dark:bg-gray-950"
          >
            <option value="channel_theme">Channel × theme</option>
            <option value="channel_status">Channel × status</option>
            <option value="theme_week">Theme × week</option>
            <option value="assignee_status">Assignee × status</option>
          </select>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-[11px]">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-gray-500">A \\ B</th>
                {cubePivot.bKeys.map((b) => (
                  <th key={b} className="px-1 py-1 text-gray-500">{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cubePivot.aKeys.map((a) => (
                <tr key={a} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-2 py-1 font-semibold">{a}</td>
                  {cubePivot.bKeys.map((b) => (
                    <td key={`${a}-${b}`} className="px-1 py-1 text-center">
                      {cubePivot.map.get(`${a}||${b}`) || '·'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {cubePivot.aKeys.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No cross-tab cells for this period.</p>
          ) : null}
        </div>
      </InsightsSectionCard>
    </div>
  )
}
