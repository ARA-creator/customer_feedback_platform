import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from 'recharts'
import InsightsSectionCard from './InsightsSectionCard'
import { formatInsuranceTagChartLabel } from '../../utils/dashboardFormatters'
import { humanizeSource } from '../../utils/insightsMetrics'
import { CHART_PALETTE } from '../../constants/palette'

function ProductHeatCell({ cell, product, theme, max, isDarkMode, onSelectTheme }) {
  const total = Number(cell?.total) || 0
  const negative = Number(cell?.negative) || 0
  const positive = Number(cell?.positive) || 0
  const neutral = Number(cell?.neutral) || 0
  const alpha = total ? 0.12 + (total / max) * 0.75 : 0

  return (
    <td className="relative px-1 py-1">
      <button
        type="button"
        disabled={!total}
        onClick={() => onSelectTheme?.(theme)}
        className="group relative flex h-9 w-full min-w-[3.5rem] items-center justify-center rounded-md border border-gray-100 disabled:opacity-40 dark:border-gray-800"
        style={{ backgroundColor: total ? `rgba(0,151,80,${alpha})` : 'transparent' }}
        aria-label={
          total
            ? `${product} × ${theme}: ${total} total, ${negative} negative, ${positive} positive, ${neutral} neutral`
            : `${product} × ${theme}: no feedback`
        }
      >
        <span className="font-semibold">{total || ''}</span>
        {total > 0 ? (
          <span
            className={`pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden w-max min-w-[8.5rem] -translate-x-1/2 rounded-lg border px-2.5 py-2 text-left shadow-lg group-hover:block group-focus-visible:block ${
              isDarkMode
                ? 'border-gray-700 bg-gray-950 text-gray-100'
                : 'border-gray-200 bg-white text-gray-900'
            }`}
            role="tooltip"
          >
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
              {formatInsuranceTagChartLabel(theme)}
            </p>
            <p className="mt-1 text-[11px]">
              <span className="font-medium text-rose-600 dark:text-rose-400">Negative:</span> {negative}
            </p>
            <p className="text-[11px]">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">Positive:</span> {positive}
            </p>
            <p className="text-[11px]">
              <span className="font-medium text-gray-600 dark:text-gray-300">Neutral:</span> {neutral}
            </p>
            <p className="mt-1 border-t border-gray-100 pt-1 text-[10px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
              Total: {total}
            </p>
          </span>
        ) : null}
      </button>
    </td>
  )
}

function formatSegmentLabel(segment) {
  const raw = String(segment || '').trim()
  if (!raw || raw.toLowerCase() === 'unknown') return 'No tier tagged'
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function CustomerSegmentRow({ segment, count, positive, neutral, negative, topThemes }) {
  const total = Math.max(1, Number(count) || 0)
  const pos = Number(positive) || 0
  const neu = Number(neutral) || 0
  const neg = Number(negative) || 0
  const label = formatSegmentLabel(segment)
  const isUntagged = label === 'No tier tagged'

  return (
    <li className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            {isUntagged
              ? 'Feedback with no customer tier in metadata (e.g. Gold, Platinum).'
              : 'Customer tier from feedback metadata.'}
          </p>
        </div>
        <p className="shrink-0 text-right text-xs text-gray-500">
          <span className="block text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">{count}</span>
          messages
        </p>
      </div>

      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Sentiment mix</p>
      <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-900">
        {pos > 0 ? <div className="bg-emerald-500" style={{ width: `${(pos / total) * 100}%` }} title={`${pos} positive`} /> : null}
        {neu > 0 ? <div className="bg-slate-400" style={{ width: `${(neu / total) * 100}%` }} title={`${neu} neutral`} /> : null}
        {neg > 0 ? <div className="bg-rose-500" style={{ width: `${(neg / total) * 100}%` }} title={`${neg} negative`} /> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          Positive <span className="font-semibold tabular-nums">{pos}</span>
          <span className="text-gray-400">({Math.round((pos / total) * 100)}%)</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
          <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden />
          Neutral <span className="font-semibold tabular-nums">{neu}</span>
          <span className="text-gray-400">({Math.round((neu / total) * 100)}%)</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
          <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden />
          Negative <span className="font-semibold tabular-nums">{neg}</span>
          <span className="text-gray-400">({Math.round((neg / total) * 100)}%)</span>
        </span>
      </div>

      {(topThemes || []).length > 0 ? (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Most common topics</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(topThemes || []).map((x) => (
              <span
                key={x.theme}
                className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              >
                {formatInsuranceTagChartLabel(x.theme)} · {x.count}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </li>
  )
}

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
        <InsightsSectionCard
          title="Customer segments"
          subtitle="Feedback grouped by customer tier (Gold, Platinum, etc.) from metadata. Items without a tier are shown separately."
        >
          {segDetail.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No feedback in this period.</p>
          ) : (
            <ul className="space-y-3">
              {segDetail.map((s) => (
                <CustomerSegmentRow
                  key={s.segment}
                  segment={s.segment}
                  count={s.count}
                  positive={s.positive}
                  neutral={s.neutral}
                  negative={s.negative}
                  topThemes={s.top_themes}
                />
              ))}
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

      <InsightsSectionCard
        title="Product × theme"
        subtitle="Heatmap of volume (primary product match). Hover for sentiment split; click a cell theme to investigate."
      >
        {productHeat.products.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No product-linked feedback in this period.</p>
        ) : (
          <div className="overflow-x-auto overflow-y-visible pb-2">
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
                    {productHeat.themes.map((t) => (
                      <ProductHeatCell
                        key={`${p}-${t}`}
                        cell={productHeat.rows.find((r) => r.product === p && r.theme === t)}
                        product={p}
                        theme={t}
                        max={productHeat.max}
                        isDarkMode={isDarkMode}
                        onSelectTheme={onSelectTheme}
                      />
                    ))}
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
