import { useEffect, useMemo, useState } from 'react'
import MiniSparkline from '../../dashboard/components/insights/MiniSparkline'
import { buildDailySparkline } from '../utils/inboxDerivedStats'
import { getInboxOpenActivity } from '../services/inbox.api'

const SUMMARY_CARDS = [
  {
    key: 'trendingTopicLabel',
    label: 'Trending topic',
    color: '#10B981',
    sparkPredicate: null,
    isText: true,
    useTopThemeSpark: true,
  },
  {
    key: 'highPriorityCount',
    label: 'High priority',
    color: '#EF4444',
    sparkPredicate: (it) => Number(it?.priority ?? it?.impact_score ?? 0) >= 80,
  },
  {
    key: 'avgPeakHoursLabel',
    label: 'Avg peak hours',
    color: '#3B82F6',
    sparkPredicate: null,
    isText: true,
  },
  {
    key: 'newCount',
    label: "Today's Feedback",
    color: '#10B981',
    // Daily arrivals (today + recent days); unread backlog is reflected in the count value.
    sparkPredicate: null,
    useNewSpark: true,
  },
]

const THEMES_PREVIEW_COUNT = 5

function displayUserName(u) {
  const name = String(u?.full_name || '').trim()
  if (name) return name
  const email = String(u?.email || '').trim()
  if (email) return email
  return u?.user_id ? `User #${u.user_id}` : 'Unknown'
}

export default function InboxSidebar({
  items,
  stats,
  topThemes,
  activeQuickFilter,
  onQuickFilter,
  onSelectTheme,
  activeTheme = 'all',
}) {

  const [openActivity, setOpenActivity] = useState(null)
  const [openActivityError, setOpenActivityError] = useState(null)
  const [themesExpanded, setThemesExpanded] = useState(false)

  const allThemes = Array.isArray(topThemes) ? topThemes : []
  const visibleThemes = useMemo(() => {
    if (themesExpanded) return allThemes
    return allThemes.slice(0, THEMES_PREVIEW_COUNT)
  }, [allThemes, themesExpanded])
  const canExpandThemes = allThemes.length > THEMES_PREVIEW_COUNT

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await getInboxOpenActivity({ limit: 8 })
        if (!cancelled) {
          setOpenActivity(data)
          setOpenActivityError(null)
        }
      } catch (e) {
        if (!cancelled) {
          const status = e?.response?.status
          if (status === 403 || status === 401) {
            setOpenActivity(null)
            setOpenActivityError(null)
          } else {
            setOpenActivityError('Could not load open activity')
          }
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <aside className="hidden w-[280px] shrink-0 space-y-4 lg:block">
      <section className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Inbox summary</h2>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {SUMMARY_CARDS.map((card) => {
            const topThemeKey = card.useTopThemeSpark ? topThemes[0]?.key : null
            const themePredicate = topThemeKey
              ? (it) => {
                  const raw = it?.insurance_tags || it?.channel_metadata?.insurance_tags
                  const tags = Array.isArray(raw) ? raw : []
                  return tags.some((t) => String(t || '').trim().toLowerCase() === topThemeKey)
                }
              : undefined
            // New-feedback spark = daily arrivals; count value = today + unread.
            const sparkPredicate = card.useNewSpark
              ? undefined
              : themePredicate || card.sparkPredicate || undefined
            const sparkData = buildDailySparkline(items, {
              days: 7,
              predicate: sparkPredicate,
            })
            const rawValue = card.isText ? stats?.[card.key] ?? '—' : stats?.[card.key] ?? 0
            const value =
              card.key === 'avgPeakHoursLabel'
                ? String(rawValue).replace(/\b(am|pm)\b/gi, (m) => m.toLowerCase())
                : rawValue
            const valueClass =
              card.isText && String(value).length > 14
                ? 'text-sm font-bold leading-snug normal-case text-gray-900 dark:text-gray-100'
                : card.isText
                  ? 'text-lg font-bold leading-snug normal-case text-gray-900 dark:text-gray-100'
                  : 'text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100'
            const interactive = card.key === 'newCount'
            const body = (
              <>
                <p className={valueClass}>{value}</p>
                <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                {card.hint ? (
                  <p className="mt-0.5 text-[10px] leading-snug text-gray-400 dark:text-gray-500">{card.hint}</p>
                ) : null}
                <div className="mt-2 h-8">
                  <MiniSparkline data={sparkData} color={card.color} height={32} />
                </div>
              </>
            )
            const shellClass =
              'rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5 text-left dark:border-gray-800 dark:bg-gray-900/50'
            if (interactive) {
              return (
                <button
                  type="button"
                  key={card.key}
                  title={card.hint || undefined}
                  onClick={() => onQuickFilter?.(activeQuickFilter === 'new' ? 'clear' : 'new')}
                  className={`${shellClass} cursor-pointer transition-colors hover:border-[#009750]/40 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20`}
                >
                  {body}
                </button>
              )
            }
            return (
              <div key={card.key} className={shellClass} title={card.hint || undefined}>
                {body}
              </div>
            )
          })}
        </div>
      </section>

      {(openActivity || openActivityError) && (
        <section className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Who opened feedback</h2>
          {openActivityError ? (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{openActivityError}</p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/50">
                  <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                    {openActivity?.users_opened_count ?? 0}
                  </p>
                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">People who opened</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/50">
                  <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                    {openActivity?.total_opens ?? 0}
                  </p>
                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Items opened</p>
                </div>
              </div>
              {(openActivity?.users || []).length === 0 ? (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  No opens recorded yet. Opens are counted when someone views a message.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {(openActivity.users || []).map((u) => (
                    <li key={u.user_id} className="flex items-center justify-between gap-2 text-xs">
                      <span
                        className="min-w-0 truncate font-medium text-gray-800 dark:text-gray-200"
                        title={u.email || ''}
                      >
                        {displayUserName(u)}
                      </span>
                      <span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
                        {u.opened_count} opened
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Top themes</h2>
        {allThemes.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">No themes in this view yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {visibleThemes.map((t) => {
              const active = String(activeTheme || 'all').toLowerCase() === String(t.key).toLowerCase()
              return (
                <li key={t.key}>
                  <button
                    type="button"
                    onClick={() => onSelectTheme?.(active ? 'all' : t.key)}
                    className={`w-full rounded-lg text-left transition-colors ${
                      active ? 'bg-emerald-50/80 dark:bg-emerald-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-900'
                    } px-1 py-0.5 -mx-1`}
                    title={active ? 'Clear theme filter' : `Filter inbox by ${t.label}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className={`font-medium ${active ? 'text-emerald-900 dark:text-emerald-100' : 'text-gray-800 dark:text-gray-200'}`}>
                        {t.label}
                      </span>
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
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {canExpandThemes ? (
          <button
            type="button"
            className="mt-4 text-xs font-semibold text-[#009750] hover:underline"
            onClick={() => setThemesExpanded((v) => !v)}
          >
            {themesExpanded
              ? 'Show fewer themes'
              : `View all themes (${allThemes.length})`}
          </button>
        ) : null}
      </section>
    </aside>
  )
}
