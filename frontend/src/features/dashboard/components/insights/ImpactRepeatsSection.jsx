import InsightsSectionCard from './InsightsSectionCard'
import RepeatPoliciesCharts from './RepeatPoliciesCharts'
import { fmtPct } from './insightsDeepFormat'
import { openFeedbackInInbox } from '../../utils/insightsInboxPreset'

export default function ImpactRepeatsSection({ repeats, isDarkMode, loading, onNavigateToInbox }) {
  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-gray-50 dark:bg-gray-900/40" />

  return (
    <div className="space-y-4">
      <RepeatPoliciesCharts repeats={repeats} isDarkMode={isDarkMode} onNavigateToInbox={onNavigateToInbox} />

      <InsightsSectionCard
        title="Repeat customers"
        subtitle={`Chronic ≥ ${repeats?.chronic_threshold || 3} messages in window.`}
      >
        <RepeatTable rows={repeats?.customers || []} onNavigateToInbox={onNavigateToInbox} />
      </InsightsSectionCard>
    </div>
  )
}

function RepeatTable({ rows, onNavigateToInbox }) {
  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-gray-500">No repeats detected in this period.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead className="text-[10px] uppercase text-gray-500">
          <tr>
            <th className="px-2 py-2">Key</th>
            <th className="px-2 py-2">Count</th>
            <th className="px-2 py-2">Neg share</th>
            <th className="px-2 py-2">Flag</th>
            <th className="px-2 py-2">Open</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.kind}-${r.key}`} className="border-t border-gray-100 dark:border-gray-800">
              <td className="max-w-[12rem] truncate px-2 py-2 font-semibold" title={r.label || r.key}>
                {r.label || r.key}
              </td>
              <td className="px-2 py-2">{r.count}</td>
              <td className="px-2 py-2">{fmtPct(r.negative_share)}</td>
              <td className="px-2 py-2">{r.chronic ? 'Chronic' : 'Repeat'}</td>
              <td className="px-2 py-2">
                <button
                  type="button"
                  className="text-[#007a42] hover:underline"
                  onClick={() => openFeedbackInInbox(r.feedback_ids?.[0], onNavigateToInbox)}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
