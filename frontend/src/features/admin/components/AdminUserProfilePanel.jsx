import { useCallback, useEffect, useState } from 'react'
import {
  FiCheck,
  FiEdit2,
  FiMessageSquare,
  FiPlus,
  FiSettings,
  FiTrendingUp,
  FiUser,
  FiX,
} from 'react-icons/fi'
import { adminGetUserDirectory, adminUpdateUser } from '../services/admin.api'
import {
  formatDateTime,
  formatRelativeLogin,
  mapActivityToTimeline,
  skillPillClass,
  slaHealthPillClass,
  userDisplayName,
  userInitials,
  workloadBarClass,
} from '../utils/adminUsersDirectory.utils'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'activity', label: 'Activity' },
  { id: 'performance', label: 'Performance' },
  { id: 'permissions', label: 'Permissions' },
]

const TIMELINE_ICON = {
  emerald: FiCheck,
  sky: FiMessageSquare,
  amber: FiTrendingUp,
  violet: FiSettings,
  gray: FiUser,
}

function TimelineIcon({ tone }) {
  const Icon = TIMELINE_ICON[tone] || FiUser
  const ring =
    tone === 'emerald'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
      : tone === 'sky'
        ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
        : tone === 'amber'
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
          : tone === 'violet'
            ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ring}`}>
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  )
}

export default function AdminUserProfilePanel({
  userId,
  initialUser,
  initialTab = 'activity',
  onClose,
  onEdit,
  onRefreshList,
}) {
  const [tab, setTab] = useState(initialTab)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [detail, setDetail] = useState(null)
  const [skillBusy, setSkillBusy] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const data = await adminGetUserDirectory(userId)
      setDetail(data)
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load user profile')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    setTab(initialTab)
    load()
  }, [load, userId, initialTab])

  const user = detail?.user || initialUser
  if (!userId) return null

  const addSkill = async () => {
    const raw = window.prompt('Add expertise tag (e.g. Claims, Billing)')
    const tag = String(raw || '').trim()
    if (!tag) return
    const existing = Array.isArray(user?.skills) ? user.skills : []
    if (existing.some((s) => String(s).toLowerCase() === tag.toLowerCase())) return
    setSkillBusy(true)
    try {
      await adminUpdateUser(userId, { skills: [...existing, tag] })
      await load()
      onRefreshList?.()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to add skill')
    } finally {
      setSkillBusy(false)
    }
  }

  const activityItems = (detail?.activity || []).map((row) => ({
    ...mapActivityToTimeline(row),
    at: row.created_at,
  }))

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-slate-900/30 dark:bg-black/50"
        aria-label="Close profile"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-sky-100/80 bg-gradient-to-b from-sky-50/95 to-white shadow-2xl dark:border-gray-800 dark:from-gray-950 dark:to-gray-950"
        role="dialog"
        aria-modal="true"
        aria-label="User profile"
      >
        <div className="shrink-0 border-b border-sky-100/80 px-5 py-5 dark:border-gray-800">
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-200 to-teal-200 text-lg font-semibold text-sky-900 dark:from-sky-900 dark:to-teal-900 dark:text-sky-100">
              {userInitials(user)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{userDisplayName(user)}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{user?.email}</p>
              <span
                className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  user?.is_active
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
                }`}
              >
                {user?.is_active ? 'Active' : 'Suspended'}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-white/80 dark:hover:bg-gray-900"
              aria-label="Close"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 flex gap-4 border-b border-sky-100/60 dark:border-gray-800" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`relative pb-2.5 text-sm font-semibold transition-colors ${
                  tab === t.id
                    ? 'text-teal-700 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-teal-600 dark:text-teal-300'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
              {error}
            </div>
          ) : null}

          {loading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading profile…</p>
          ) : tab === 'activity' ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Recent activity
              </h3>
              {activityItems.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No recorded activity yet.</p>
              ) : (
                <ul className="mt-4 space-y-0">
                  {activityItems.map((item, idx) => (
                    <li key={`${item.at}-${idx}`} className="relative flex gap-3 pb-6">
                      {idx < activityItems.length - 1 ? (
                        <span
                          className="absolute left-4 top-9 bottom-0 w-px bg-sky-200/80 dark:bg-gray-700"
                          aria-hidden
                        />
                      ) : null}
                      <TimelineIcon tone={item.tone} />
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
                        {item.subtitle ? (
                          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{item.subtitle}</p>
                        ) : null}
                        {item.at ? (
                          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                            {formatRelativeLogin(item.at) === 'just now'
                              ? formatDateTime(item.at)
                              : formatRelativeLogin(item.at)}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {!loading && tab === 'overview' ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  User details
                </h3>
                <dl className="mt-3 space-y-2.5 text-sm">
                  {[
                    ['Role', user?.role_label || user?.role || '—'],
                    ['Team', user?.team_label || user?.team || '—'],
                    ['Region', user?.region || '—'],
                    ['Manager', user?.manager_name || '—'],
                    ['Joined', user?.created_at ? formatDateTime(user.created_at) : '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                      <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Expertise (Skills)
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(user?.skills || []).map((skill, i) => (
                    <span
                      key={skill}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${skillPillClass(i)}`}
                    >
                      {skill}
                    </span>
                  ))}
                  <button
                    type="button"
                    disabled={skillBusy}
                    onClick={addSkill}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:border-teal-400 hover:text-teal-700 dark:border-gray-600 dark:text-gray-300"
                  >
                    <FiPlus className="h-3 w-3" />
                    Add skill
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onEdit?.(user)}
                className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                <FiEdit2 className="h-4 w-4" />
                Edit user
              </button>
            </div>
          ) : null}

          {!loading && tab === 'performance' ? (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Open items', value: user?.open_items ?? 0 },
                { label: 'Workload', value: `${user?.workload_pct ?? 0}%` },
                { label: 'SLA health', value: `${user?.sla_health_pct ?? 100}%` },
                { label: 'SLA breaches', value: user?.sla_breaches ?? 0 },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl border border-sky-100/80 bg-white/80 p-3 dark:border-gray-800 dark:bg-gray-900/50"
                >
                  <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{card.label}</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">{card.value}</p>
                </div>
              ))}
              <p className="col-span-2 text-xs text-gray-500 dark:text-gray-400">
                Workload is estimated from assigned open feedback (cap {50} items). SLA health is the share of
                assigned items still within due date.
              </p>
            </div>
          ) : null}

          {!loading && tab === 'permissions' ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Effective permissions
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {(detail?.permissions || []).length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No permissions assigned via roles.</p>
                ) : (
                  detail.permissions.map((p) => (
                    <span
                      key={p}
                      className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    >
                      {p}
                    </span>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  )
}
