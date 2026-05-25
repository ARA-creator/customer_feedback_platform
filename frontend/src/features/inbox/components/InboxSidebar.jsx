import MiniSparkline from '../../dashboard/components/insights/MiniSparkline'
import { buildDailySparkline } from '../utils/inboxDerivedStats'

const SUMMARY_CARDS = [
  { key: 'newCount', label: 'New', color: '#10B981', sparkPredicate: null },
  { key: 'highPriorityCount', label: 'High priority', color: '#EF4444', sparkPredicate: (it) => Number(it?.priority ?? it?.impact_score ?? 0) >= 80 },
  { key: 'negativePct', label: 'Negative', color: '#EF4444', sparkPredicate: (it) => String(it?.sentiment_label || '').toLowerCase() === 'negative', suffix: '%' },
  { key: 'avgResponseLabel', label: 'Avg. first response', color: '#3B82F6', sparkPredicate: null, isText: true },
]

const QUICK_FILTERS = [
  { id: 'unread', label: 'Unread', dot: true },
  { id: 'needs_response', label: 'Needs response' },
  { id: 'high_priority', label: 'High priority' },
  { id: 'negative_7d', label: 'Negative (7d)' },
]

export default function InboxSidebar({
  items,
  stats,
  topThemes,
  activeQuickFilter,
  onQuickFilter,
  unreadCount,
  needsResponseCount,
  highPriorityCount,
  negative7dCount = 0,
}) {
  const quickCounts = {
    unread: unreadCount,
    needs_response: needsResponseCount,
    high_priority: highPriorityCount,
    negative_7d: negative7dCount,
  }

  return (
    <aside className="hidden w-[280px] shrink-0 space-y-4 lg:block">
      <section className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Inbox summary</h2>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {SUMMARY_CARDS.map((card) => {
            const spark = buildDailySparkline(items, {
              days: 7,
              predicate: card.sparkPredicate || undefined,
            })
            const value = card.isText
              ? stats?.avgResponseLabel ?? '—'
              : card.key === 'negativePct'
                ? `${stats?.negativePct ?? 0}%`
                : stats?.[card.key] ?? 0
            return (
              <div
                key={card.key}
                className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900/50"
              >
                <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {value}
                  {card.suffix && !card.isText ? '' : null}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                <div className="mt-2 h-8">
                  <MiniSparkline data={spark} color={card.color} height={32} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Top themes</h2>
        {topThemes.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">No themes in this view yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {topThemes.map((t) => (
              <li key={t.key}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{t.label}</span>
                  <span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
                    {t.count}{' '}
                    <span className="text-gray-400">{t.pct}%</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-full rounded-full bg-[#10B981]"
                    style={{ width: `${Math.min(100, t.pct)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="mt-4 text-xs font-semibold text-[#009750] hover:underline"
          onClick={() => onQuickFilter?.('clear_themes')}
        >
          View all themes
        </button>
      </section>

      <section className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Quick filters</h2>
        <ul className="mt-2 space-y-0.5">
          {QUICK_FILTERS.map((f) => {
            const active = activeQuickFilter === f.id
            const count = quickCounts[f.id] ?? 0
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onQuickFilter?.(active ? 'clear' : f.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    active
                      ? 'bg-emerald-50 font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900'
                  }`}
                >
                  {f.dot ? (
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${active ? 'bg-[#10B981]' : 'bg-gray-300 dark:bg-gray-600'}`}
                      aria-hidden
                    />
                  ) : (
                    <span className="w-2 shrink-0" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">{f.label}</span>
                  <span className="tabular-nums text-xs text-gray-500 dark:text-gray-400">{count}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </aside>
  )
}
