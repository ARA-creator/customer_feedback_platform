import InsightsSectionCard from './InsightsSectionCard'
import { DOW, fmtDelta, fmtHours, fmtPct } from './insightsDeepFormat'

function DeltaCard({ label, current, prior, delta, format = 'num' }) {
  const cur =
    format === 'pct' ? fmtPct(current) : format === 'hours' ? fmtHours(current) : current ?? '—'
  const prv =
    format === 'pct' ? fmtPct(prior) : format === 'hours' ? fmtHours(prior) : prior ?? '—'
  const d =
    format === 'pct' ? fmtDelta(delta, { pct: true }) : format === 'hours' ? fmtDelta(delta) : fmtDelta(delta)
  const up = Number(delta) > 0
  const down = Number(delta) < 0
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-950">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">{cur}</p>
      <p className="mt-1 text-[11px] text-gray-500">Prior {prv}</p>
      <p
        className={`mt-0.5 text-xs font-semibold ${
          up ? 'text-amber-600 dark:text-amber-300' : down ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500'
        }`}
      >
        Δ {d}
      </p>
    </div>
  )
}

export default function LeadershipSection({
  benchmark,
  capacity,
  loading,
}) {
  const heat = capacity?.volume_heatmap || []
  const maxH = Math.max(1, ...heat.map((c) => Number(c.count) || 0))

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-gray-50 dark:bg-gray-900/40" />

  const b = benchmark || {}
  const cur = b.current || {}
  const prior = b.prior || {}
  const deltas = b.deltas || {}

  return (
    <div className="space-y-4">
      <InsightsSectionCard
        title="Period-over-period KPI pack"
        subtitle={`${b.current_label || 'Current'} vs ${b.prior_label || 'prior equal window'}.`}
      >
        {!benchmark ? (
          <p className="py-8 text-center text-sm text-gray-500">Benchmark disabled for this load.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <DeltaCard label="Volume" current={cur.volume} prior={prior.volume} delta={deltas.volume} />
            <DeltaCard
              label="Negative share"
              current={cur.negative_share}
              prior={prior.negative_share}
              delta={deltas.negative_share}
              format="pct"
            />
            <DeltaCard
              label="Response p50"
              current={cur.response_p50}
              prior={prior.response_p50}
              delta={deltas.response_p50}
              format="hours"
            />
            <DeltaCard
              label="Breach rate"
              current={cur.breach_rate}
              prior={prior.breach_rate}
              delta={deltas.breach_rate}
              format="pct"
            />
            <DeltaCard
              label="Escalation rate"
              current={cur.escalation_rate}
              prior={prior.escalation_rate}
              delta={deltas.escalation_rate}
              format="pct"
            />
          </div>
        )}
      </InsightsSectionCard>

      <InsightsSectionCard
        title="Capacity planning"
        subtitle={capacity?.note || 'Volume × handle-time staffing hint.'}
      >
        <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
            <p className="text-[10px] uppercase text-gray-500">Assumed handle time</p>
            <p className="text-lg font-semibold">{fmtHours(capacity?.assumed_handle_hours)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
            <p className="text-[10px] uppercase text-gray-500">Peak hourly volume</p>
            <p className="text-lg font-semibold">{capacity?.peak_hourly_volume ?? 0}</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
            <p className="text-[10px] uppercase text-gray-500">Staffing hint (FTE)</p>
            <p className="text-lg font-semibold">{capacity?.staffing_hint_fte ?? '—'}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `32px repeat(24, 14px)` }}>
            <div />
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={`h-${h}`} className="text-center text-[8px] text-gray-400">
                {h % 6 === 0 ? h : ''}
              </div>
            ))}
            {DOW.map((label, dow) => (
              <HeatRow key={label} label={label} dow={dow} heat={heat} maxH={maxH} />
            ))}
          </div>
        </div>
      </InsightsSectionCard>
    </div>
  )
}

function HeatRow({ label, dow, heat, maxH }) {
  return (
    <>
      <div className="pr-1 text-right text-[10px] text-gray-500">{label}</div>
      {Array.from({ length: 24 }).map((_, hour) => {
        const cell = heat.find((c) => c.dow === dow && c.hour === hour)
        const n = Number(cell?.count) || 0
        const alpha = n ? 0.15 + (n / maxH) * 0.85 : 0
        return (
          <div
            key={`${dow}-${hour}`}
            title={`${label} ${hour}:00 — ${n}`}
            className="h-3.5 w-3.5 rounded-sm border border-gray-100 dark:border-gray-800"
            style={{ backgroundColor: n ? `rgba(14,165,233,${alpha})` : 'transparent' }}
          />
        )
      })}
    </>
  )
}
