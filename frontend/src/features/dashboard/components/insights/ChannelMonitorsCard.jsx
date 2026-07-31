import { useMemo } from 'react'
import InsightsSectionCard from './InsightsSectionCard'
import MiniSparkline from './MiniSparkline'
import {
  buildSourceSparkline,
  computePainShare,
  fmtPct,
  gaugeColorFromScore,
  humanizeSource,
} from '../../utils/insightsMetrics'
import { buildSourcePreset } from '../../utils/insightsInboxPreset'

function SentimentGauge({ avgScore, size = 48 }) {
  const v = Number(avgScore)
  const label = Number.isFinite(v) ? v.toFixed(2) : '—'
  const pct = Number.isFinite(v) ? ((v + 1) / 2) * 100 : 50
  const color = gaugeColorFromScore(avgScore)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size / 2 + 4 }}>
      <svg width={size} height={size / 2 + 4} viewBox={`0 0 ${size} ${size / 2 + 4}`} className="overflow-visible">
        <path
          d={`M 4 ${size / 2} A ${size / 2 - 4} ${size / 2 - 4} 0 0 1 ${size - 4} ${size / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-gray-200 dark:text-gray-800"
        />
        <path
          d={`M 4 ${size / 2} A ${size / 2 - 4} ${size / 2 - 4} 0 0 1 ${size - 4} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${(pct / 100) * Math.PI * (size / 2 - 4)} ${Math.PI * (size / 2 - 4)}`}
        />
      </svg>
      <span
        className="absolute inset-x-0 bottom-0 text-center text-[10px] font-bold tabular-nums text-gray-900 dark:text-gray-100"
        style={{ lineHeight: 1 }}
      >
        {label}
      </span>
    </div>
  )
}

export default function ChannelMonitorsCard({
  sourcePerformance,
  sourceTrends,
  metrics,
  timeWindow = 'all',
  selectedSourceKey,
  onSelectSource,
  onNavigateToInbox,
  loading,
  sentimentFilter = 'all',
  statusFilter = 'all',
}) {
  const totalFeedback = Number(metrics?.totalFeedback ?? 0) || 0
  const allNegative = Number(metrics?.negative ?? 0) || 0

  const sources = useMemo(() => {
    const list = Array.isArray(sourcePerformance) ? sourcePerformance : []
    return [...list]
      .filter((s) => (Number(s?.total ?? 0) || 0) > 0)
      .sort((a, b) => (Number(b?.total ?? 0) || 0) - (Number(a?.total ?? 0) || 0))
      .slice(0, 6)
  }, [sourcePerformance])

  return (
    <InsightsSectionCard
      title="Channel monitors"
      subtitle="Voice = volume share · Pain = share of all negative feedback"
    >
      {loading ? (
        <div className="w-full h-64 rounded-2xl bg-gray-50 dark:bg-gray-900/40 animate-pulse" />
      ) : sources.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">No source performance yet.</p>
      ) : (
        <div className="space-y-3">
          {sources.map((s) => {
            const total = Number(s?.total ?? 0) || 0
            const voiceShare = total / Math.max(1, totalFeedback)
            const painShare = computePainShare(s, allNegative)
            const spark = buildSourceSparkline(sourceTrends, s.source)
            const selected = selectedSourceKey === s.source

            return (
              <button
                key={s.source}
                type="button"
                onClick={() => onSelectSource?.(s.source)}
                onDoubleClick={() => {
                  const preset = buildSourcePreset(s.source, timeWindow, sentimentFilter, statusFilter)
                  if (preset) onNavigateToInbox?.(preset)
                }}
                className={`w-full rounded-2xl border px-3 py-3 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#009750]/40 ${
                  selected
                    ? 'border-[#009750] ring-2 ring-[#009750]/25 bg-emerald-50/40 dark:bg-emerald-950/20'
                    : 'border-gray-200/70 bg-white/90 hover:-translate-y-px dark:border-white/10 dark:bg-gray-950/70'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {humanizeSource(s.source)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-300 tabular-nums">
                      {total} feedback
                    </p>
                  </div>
                  <SentimentGauge avgScore={s.avg_score} />
                </div>
                <div className="mt-2 space-y-1.5">
                  <div>
                    <div className="flex justify-between text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                      <span>Voice</span>
                      <span className="tabular-nums">{fmtPct(voiceShare)}</span>
                    </div>
                    <div className="mt-0.5 h-1.5 rounded-full bg-gray-100 dark:bg-gray-900/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-500/80 to-emerald-600/80 transition-all duration-300"
                        style={{ width: `${Math.max(4, Math.round(voiceShare * 100))}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                      <span>Pain</span>
                      <span className="tabular-nums">{fmtPct(painShare)}</span>
                    </div>
                    <div className="mt-0.5 h-1.5 rounded-full bg-gray-100 dark:bg-gray-900/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-400/90 to-rose-500/90 transition-all duration-300"
                        style={{ width: `${Math.max(4, Math.round(painShare * 100))}%` }}
                      />
                    </div>
                  </div>
                  <MiniSparkline data={spark} color="#009750" height={28} />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </InsightsSectionCard>
  )
}
