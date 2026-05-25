import { FiArrowRight, FiRefreshCw, FiZap } from 'react-icons/fi'

function pickInsightText(result, error) {
  if (error) return error
  const analysis = result?.analysis || {}
  if (analysis.summary && String(analysis.summary).trim()) return String(analysis.summary).trim()
  if (Array.isArray(analysis.key_findings) && analysis.key_findings[0]) {
    return String(analysis.key_findings[0]).trim()
  }
  if (result?.empty || Number(result?.feedback_count) <= 0) {
    return 'No feedback in this period yet. Adjust the time filter or ingest more channels to generate insights.'
  }
  return 'Run analysis to summarize sentiment, themes, and recommended actions for this period.'
}

export default function AiInsightBar({
  loading,
  error,
  result,
  timeFilterLabel,
  onRefresh,
  onViewDetails,
  refreshDisabled,
}) {
  const aiGenerated = !!result?.ai_generated
  const text = loading ? 'Analyzing feedback for this period…' : pickInsightText(result, error)

  return (
    <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 via-white to-emerald-50/50 p-4 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/40 dark:via-gray-950 dark:to-emerald-950/20 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#009750] text-white shadow-sm">
            <FiZap className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              AI Insight
              {aiGenerated ? (
                <span className="ml-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  · {timeFilterLabel || 'Selected period'}
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300">{text}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshDisabled || loading}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
          <button
            type="button"
            onClick={onViewDetails}
            disabled={loading}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            View insights
            <FiArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
