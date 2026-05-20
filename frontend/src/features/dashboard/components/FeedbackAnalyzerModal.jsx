import { FiAlertCircle, FiX } from 'react-icons/fi'

function formatGeminiError(err) {
  const raw = String(err || '').trim()
  if (!raw) return 'AI analysis is unavailable.'
  if (raw === 'missing_api_key') {
    return 'GEMINI_API_KEY is not set. Add it to the repo-root .env and restart the backend.'
  }
  if (raw.includes("No module named 'google'") || raw.toLowerCase().includes('google-genai')) {
    return (
      'Google Gemini SDK is not installed in the Python environment running Flask. ' +
      'From repo root: pip install -r backend/requirements.txt — then start the backend with ' +
      '../.venv/bin/python run.py from the backend/ folder.'
    )
  }
  return raw
}

function BulletList({ items, empty = 'None identified.' }) {
  const rows = Array.isArray(items) ? items.filter(Boolean) : []
  if (!rows.length) {
    return <p className="text-sm text-gray-600 dark:text-gray-300">{empty}</p>
  }
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm text-gray-800 dark:text-gray-100">
      {rows.map((item, idx) => (
        <li key={`${idx}-${item.slice(0, 24)}`}>{item}</li>
      ))}
    </ul>
  )
}

export default function FeedbackAnalyzerModal({
  open,
  onClose,
  loading,
  error,
  result,
  timeFilterLabel,
}) {
  if (!open) return null

  const analysis = result?.analysis || {}
  const metrics = result?.metrics || {}
  const aiGenerated = !!result?.ai_generated

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Feedback analyzer"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose?.()
      }}
      tabIndex={-1}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-gray-100 bg-white px-4 sm:px-5 py-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Feedback Analyzer</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {timeFilterLabel || result?.time_window_label || 'Selected period'}
                {result?.feedback_count != null && ` · ${result.feedback_count} items`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-gray-200 bg-white px-2 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <FiX className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 space-y-5">
          {loading && (
            <div className="space-y-3" aria-live="polite">
              <p className="text-sm text-gray-600 dark:text-gray-300">Analyzing feedback for this period…</p>
              <div className="h-4 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
              <div className="h-4 w-4/6 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          )}

          {error && !loading && (
            <div
              className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
              role="alert"
            >
              <FiAlertCircle className="h-5 w-5 shrink-0" aria-hidden />
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && result && (
            <>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  {metrics.positive ?? 0} positive
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  {metrics.negative ?? 0} negative
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  {metrics.neutral ?? 0} neutral
                </span>
                {(metrics.high_priority ?? 0) > 0 && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    {metrics.high_priority} high priority
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                {aiGenerated ? 'Generated with AI' : 'Summary generated from dashboard stats'}
                {result.model_name ? ` · ${result.model_name}` : ''}
              </p>
              {!aiGenerated && result?.gemini_error && (
                <p className="text-xs text-amber-800 dark:text-amber-200 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/30">
                  {formatGeminiError(result.gemini_error)} Showing a stats-based summary instead.
                </p>
              )}

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Summary
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-800 dark:text-gray-100">
                  {analysis.summary || 'No summary available.'}
                </p>
              </section>

              {Array.isArray(analysis.key_themes) && analysis.key_themes.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Key themes
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {analysis.key_themes.map((theme) => (
                      <span
                        key={theme}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {analysis.sentiment_insights && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Sentiment insights
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-800 dark:text-gray-100">
                    {analysis.sentiment_insights}
                  </p>
                </section>
              )}

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Risks
                </h3>
                <div className="mt-2">
                  <BulletList items={analysis.risks} empty="No major risks flagged for this period." />
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Recommendations
                </h3>
                <div className="mt-2">
                  <BulletList items={analysis.recommendations} />
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
