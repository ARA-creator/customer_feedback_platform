import { formatInsuranceTagChartLabel } from '../../utils/dashboardFormatters'
import { computeSentimentIndex, humanizeSource } from '../../utils/insightsMetrics'
import InsightsSectionCard from './InsightsSectionCard'

function cellStyle(cell, isDarkMode) {
  const total = Number(cell?.total ?? 0) || 0
  if (total <= 0) return { background: isDarkMode ? 'rgb(17 24 39 / 0.4)' : 'rgb(243 244 246)' }
  const idx = computeSentimentIndex(cell.positive, cell.negative, total)
  const t = (idx + 1) / 2
  const hue = Math.round(t * 140)
  const light = isDarkMode ? 32 : 88
  const sat = 55 + Math.abs(idx) * 15
  return {
    background: `hsl(${hue}, ${sat}%, ${light}%)`,
    color: t < 0.45 ? '#fff' : isDarkMode ? '#f8fafc' : '#0f172a',
  }
}

export default function SourceThemeMatrixCard({
  sourceThemeMatrix,
  selectedThemeKey,
  selectedSourceKey,
  onSelectCell,
  isDarkMode,
  loading,
}) {
  const matrix = sourceThemeMatrix?.matrix || {}
  const sources = Array.isArray(sourceThemeMatrix?.sources) ? sourceThemeMatrix.sources : []
  const themes = Array.isArray(sourceThemeMatrix?.themes) ? sourceThemeMatrix.themes : []

  return (
    <InsightsSectionCard
      title="Channel × theme"
      subtitle="Click a cell to select both dimensions. Brighter green = more positive; rose = more negative."
    >
      {loading ? (
        <div className="w-full h-40 rounded-2xl bg-gray-50 dark:bg-gray-900/40 animate-pulse" />
      ) : sources.length === 0 || themes.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">Not enough cross-channel theme data yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200/70 dark:border-white/10">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="px-2 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 sticky left-0 bg-white/95 dark:bg-gray-950/95">
                  Channel
                </th>
                {themes.map((th) => (
                  <th
                    key={th}
                    className={`px-2 py-2 text-center font-semibold min-w-[72px] ${
                      selectedThemeKey === th
                        ? 'text-emerald-800 dark:text-emerald-200'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span className="block truncate max-w-[88px] mx-auto" title={formatInsuranceTagChartLabel(th)}>
                      {formatInsuranceTagChartLabel(th)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sources.map((src) => {
                const rowDimmed = selectedSourceKey && selectedSourceKey !== src
                return (
                  <tr key={src} className="border-t border-gray-100 dark:border-gray-800">
                    <td
                      className={`px-2 py-1.5 font-semibold sticky left-0 bg-white/95 dark:bg-gray-950/95 ${
                        selectedSourceKey === src
                          ? 'text-emerald-800 dark:text-emerald-200'
                          : 'text-gray-700 dark:text-gray-300'
                      } ${rowDimmed ? 'opacity-40' : ''}`}
                    >
                      {humanizeSource(src)}
                    </td>
                    {themes.map((th) => {
                      const cell = matrix[src]?.[th]
                      const count = Number(cell?.total ?? 0) || 0
                      const colDimmed = selectedThemeKey && selectedThemeKey !== th
                      const dimmed = rowDimmed || colDimmed
                      const selected = selectedSourceKey === src && selectedThemeKey === th
                      const hm = cellStyle(cell, isDarkMode)
                      return (
                        <td key={th} className={`p-0.5 ${dimmed ? 'opacity-35' : ''}`}>
                          <button
                            type="button"
                            disabled={count <= 0}
                            onClick={() => count > 0 && onSelectCell?.(src, th)}
                            className={`w-full min-h-[36px] rounded-md text-center font-semibold tabular-nums transition-all focus:outline-none focus:ring-2 focus:ring-[#009750]/40 ${
                              count <= 0 ? 'cursor-default' : 'cursor-pointer hover:brightness-95'
                            } ${selected ? 'ring-2 ring-[#009750] ring-offset-1 dark:ring-offset-gray-950' : ''}`}
                            style={count > 0 ? hm : undefined}
                            title={
                              count > 0
                                ? `${humanizeSource(src)} × ${formatInsuranceTagChartLabel(th)}: ${count} (${cell.positive}+ / ${cell.negative}−)`
                                : undefined
                            }
                          >
                            {count || ''}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </InsightsSectionCard>
  )
}
