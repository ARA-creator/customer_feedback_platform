import { useMemo, useState } from 'react'
import { FiInbox } from 'react-icons/fi'
import InsightsSectionCard from './InsightsSectionCard'
import MiniSparkline from './MiniSparkline'
import {
  buildThemeSparkline,
  buildTopThemes,
  computeThemeRisk,
  fmtPct,
  sentimentGradientStyle,
} from '../../utils/insightsMetrics'
import { buildThemePreset } from '../../utils/insightsInboxPreset'

function SortToggle({ sortMode, onChange }) {
  return (
    <div
      className="inline-flex rounded-xl border border-gray-200 bg-white/90 p-0.5 dark:border-white/10 dark:bg-gray-950/70"
      role="group"
      aria-label="Sort themes"
    >
      {[
        { id: 'volume', label: 'Volume' },
        { id: 'risk', label: 'Risk' },
      ].map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
            sortMode === id
              ? 'bg-[#009750] text-white'
              : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900'
          }`}
          aria-pressed={sortMode === id}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function SentimentRibbon({ theme, totalFeedback, className = '' }) {
  const share = theme.total / Math.max(1, totalFeedback)
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{theme.label}</p>
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 tabular-nums shrink-0">
          {theme.total} · {fmtPct(share)}
        </p>
      </div>
      <div className="mt-2 h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-900/60">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.max(4, Math.round(share * 100))}%`,
            ...sentimentGradientStyle(theme.positive, theme.neutral, theme.negative, theme.total),
          }}
        />
      </div>
      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
        {theme.positive} positive · {theme.neutral} neutral · {theme.negative} negative
      </p>
    </div>
  )
}

function BentoTile({
  theme,
  rank,
  totalFeedback,
  selected,
  insuranceTagsTrends,
  onSelect,
  onOpenInbox,
}) {
  const share = theme.total / Math.max(1, totalFeedback)
  const flexGrow = Math.max(1, Math.round(share * 100))
  const spark = buildThemeSparkline(insuranceTagsTrends, theme.key)
  const risk = computeThemeRisk(theme)

  return (
    <button
      type="button"
      onClick={() => onSelect(theme.key)}
      onDoubleClick={(e) => {
        e.preventDefault()
        onOpenInbox?.(theme.key)
      }}
      className={`relative flex flex-col justify-between rounded-2xl border p-3 text-left min-h-[88px] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#009750]/40 ${
        selected
          ? 'border-[#009750] ring-2 ring-[#009750]/30 shadow-md'
          : 'border-gray-200/80 hover:border-emerald-200 dark:border-white/10 dark:hover:border-emerald-900/50'
      }`}
      style={{
        flexGrow,
        flexBasis: '120px',
        background: sentimentGradientStyle(theme.positive, theme.neutral, theme.negative, theme.total).background,
        opacity: selected ? 1 : 0.92,
      }}
    >
      <span className="absolute top-2 right-2 text-[10px] font-bold text-gray-700/80 dark:text-gray-200/90">
        #{rank}
      </span>
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 pr-6 truncate">{theme.label}</p>
        <p className="mt-0.5 text-xs font-semibold text-gray-800/90 dark:text-gray-100/90 tabular-nums">
          {theme.total} · {fmtPct(share)}
        </p>
      </div>
      <div className="mt-2 space-y-1">
        <MiniSparkline data={spark} color="#007a42" height={28} />
        <p className="text-[10px] font-medium text-gray-700/90 dark:text-gray-200/90">
          {Math.round(risk * 100)}% negative
        </p>
      </div>
    </button>
  )
}

export default function ThemeLandscapeCard({
  insuranceTagsBreakdown,
  insuranceTagsTrends,
  metrics,
  timeWindow = 'all',
  selectedThemeKey,
  onSelectTheme,
  onNavigateToInbox,
  loading,
  sentimentFilter = 'all',
  statusFilter = 'all',
}) {
  const [sortMode, setSortMode] = useState('volume')
  const totalFeedback = Number(metrics?.totalFeedback ?? 0) || 0

  const themes = useMemo(() => {
    const base = buildTopThemes(insuranceTagsBreakdown, 8)
    if (sortMode === 'risk') {
      return [...base].sort((a, b) => computeThemeRisk(b) - computeThemeRisk(a))
    }
    return base
  }, [insuranceTagsBreakdown, sortMode])

  const openInbox = (themeKey) => {
    const preset = buildThemePreset(themeKey, timeWindow, sentimentFilter, statusFilter)
    if (preset) onNavigateToInbox?.(preset)
  }

  return (
    <InsightsSectionCard
      title="Theme landscape"
      subtitle="Select a theme to investigate. Double-click to open inbox."
      right={<SortToggle sortMode={sortMode} onChange={setSortMode} />}
    >
      {loading ? (
        <div className="w-full h-64 rounded-2xl bg-gray-50 dark:bg-gray-900/40 animate-pulse" />
      ) : themes.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">No theme data yet.</p>
      ) : (
        <>
          <div className="hidden lg:flex flex-wrap content-start gap-2">
            {themes.map((t, idx) => (
              <BentoTile
                key={t.key}
                theme={t}
                rank={idx + 1}
                totalFeedback={totalFeedback}
                selected={selectedThemeKey === t.key}
                insuranceTagsTrends={insuranceTagsTrends}
                onSelect={onSelectTheme}
                onOpenInbox={openInbox}
              />
            ))}
          </div>

          <ul className="lg:hidden space-y-3">
            {themes.map((t) => (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => onSelectTheme?.(t.key)}
                  onDoubleClick={() => openInbox(t.key)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[#009750]/40 ${
                    selectedThemeKey === t.key
                      ? 'border-[#009750] bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'border-gray-200 dark:border-gray-800'
                  }`}
                >
                  <SentimentRibbon theme={t} totalFeedback={totalFeedback} />
                </button>
              </li>
            ))}
          </ul>

          {selectedThemeKey ? (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => openInbox(selectedThemeKey)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                <FiInbox className="h-3.5 w-3.5" aria-hidden />
                Open inbox for theme
              </button>
            </div>
          ) : null}
        </>
      )}
    </InsightsSectionCard>
  )
}
