import { useEffect, useMemo, useState } from 'react'
import {
  FiBarChart2,
  FiChevronLeft,
  FiChevronRight,
  FiEdit2,
  FiEye,
  FiFilter,
  FiMoreVertical,
  FiSearch,
} from 'react-icons/fi'
import { adminListUsersDirectory } from '../services/admin.api'
import {
  filterDirectoryUsers,
  formatDateTime,
  formatRelativeLogin,
  uniqueFilterOptions,
  userDisplayName,
  userInitials,
} from '../utils/adminUsersDirectory.utils'
import AdminUserProfilePanel from './AdminUserProfilePanel'

const PAGE_SIZE = 6

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="relative min-w-[7rem]">
      <label className="sr-only">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-[40px] appearance-none rounded-lg border border-sky-100 bg-white/90 py-2 pl-3 pr-8 text-xs font-medium text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
        ▾
      </span>
    </div>
  )
}

export default function AdminUsersDirectory({
  onEditUser,
  onResetPassword,
  onSetStatus,
  onRemoveUser,
  saving = false,
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [users, setUsers] = useState([])
  const [q, setQ] = useState('')
  const [team, setTeam] = useState('all')
  const [region, setRegion] = useState('all')
  const [role, setRole] = useState('all')
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [profileUserId, setProfileUserId] = useState(null)
  const [profileUser, setProfileUser] = useState(null)
  const [profileTab, setProfileTab] = useState('activity')
  const [menuUserId, setMenuUserId] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminListUsersDirectory({ scope: 'active' })
      setUsers(data?.users || [])
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filterOpts = useMemo(() => uniqueFilterOptions(users), [users])

  const filtered = useMemo(
    () => filterDirectoryUsers(users, { q, team, region, role }),
    [users, q, team, region, role],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)
  const pageItems = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [q, team, region, role])

  const openProfile = (u, tab = 'activity') => {
    setProfileUserId(u.id)
    setProfileUser(u)
    setProfileTab(tab)
    setMenuUserId(null)
  }

  return (
    <div className="rounded-2xl border border-sky-100/80 bg-gradient-to-br from-sky-50/50 via-white to-white p-4 shadow-sm dark:border-gray-800 dark:from-gray-950 dark:via-gray-950 dark:to-gray-950 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-h-[40px] min-w-[12rem] flex-1 items-center gap-2 rounded-lg border border-sky-100 bg-white/90 px-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <FiSearch className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search users…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-gray-100"
            aria-label="Search users"
          />
        </div>
        <FilterSelect
          label="Team"
          value={team}
          onChange={setTeam}
          options={[
            { value: 'all', label: 'Team: All' },
            ...filterOpts.teams.map((t) => ({ value: t, label: `Team: ${t}` })),
          ]}
        />
        <FilterSelect
          label="Region"
          value={region}
          onChange={setRegion}
          options={[
            { value: 'all', label: 'Region: All' },
            ...filterOpts.regions.map((r) => ({ value: r, label: `Region: ${r}` })),
          ]}
        />
        <button
          type="button"
          onClick={() => setShowMoreFilters((v) => !v)}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-sky-100 bg-white/90 px-3 text-xs font-medium text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          <FiFilter className="h-3.5 w-3.5" />
          More filters
        </button>
      </div>

      {showMoreFilters ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <FilterSelect
            label="Role"
            value={role}
            onChange={setRole}
            options={[
              { value: 'all', label: 'Role: All' },
              ...filterOpts.roles.map((r) => ({ value: r, label: `Role: ${r}` })),
            ]}
          />
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-sky-100/60 bg-white/60 dark:border-gray-800 dark:bg-gray-950/40">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-sky-100/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <th className="px-4 py-3">User</th>
              <th className="px-3 py-3">Role</th>
              <th className="px-3 py-3">Team</th>
              <th className="px-3 py-3">Security Status</th>
              <th className="px-3 py-3">Last Login</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sky-50 dark:divide-gray-800/80">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Loading users…
                </td>
              </tr>
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No users match these filters.
                </td>
              </tr>
            ) : (
              pageItems.map((u) => {
                const sec = u.security || {}
                const secDot =
                  sec.level === 'ok'
                    ? 'bg-emerald-500'
                    : sec.level === 'warning'
                      ? 'bg-rose-500'
                      : 'bg-gray-400'
                return (
                  <tr key={u.id} className="bg-white/80 hover:bg-sky-50/50 dark:bg-transparent dark:hover:bg-gray-900/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-teal-100 text-xs font-bold text-sky-900 dark:from-sky-900 dark:to-teal-900 dark:text-sky-100">
                          {userInitials(u)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{userDisplayName(u)}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-800 dark:text-gray-200">{u.role_label || u.role || '—'}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{u.team_label || u.team || '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${secDot}`} aria-hidden />
                        <div>
                          <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                            Last login: {formatRelativeLogin(u.last_login_at)}
                          </p>
                          <p
                            className={`text-[11px] ${
                              sec.level === 'warning'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {sec.detail || sec.label || '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {formatDateTime(u.last_login_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openProfile(u)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-sky-50 hover:text-teal-700 dark:hover:bg-gray-800"
                          title="View profile"
                          aria-label="View profile"
                        >
                          <FiEye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openProfile(u, 'performance')}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-sky-50 hover:text-teal-700 dark:hover:bg-gray-800"
                          title="Performance"
                          aria-label="View performance"
                        >
                          <FiBarChart2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setMenuUserId(menuUserId === u.id ? null : u.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-sky-50 dark:hover:bg-gray-800"
                          title="More actions"
                          aria-label="More actions"
                        >
                          <FiMoreVertical className="h-4 w-4" />
                        </button>
                        {menuUserId === u.id ? (
                          <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-950">
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900"
                              onClick={() => {
                                setMenuUserId(null)
                                onEditUser?.(u)
                              }}
                            >
                              <FiEdit2 className="h-3.5 w-3.5" />
                              Edit user
                            </button>
                            {u.auth_provider !== 'azure_ad' ? (
                              <button
                                type="button"
                                className="flex w-full px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900"
                                onClick={() => {
                                  setMenuUserId(null)
                                  onResetPassword?.(u)
                                }}
                              >
                                Reset password
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={saving}
                              className="flex w-full px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900"
                              onClick={() => {
                                setMenuUserId(null)
                                onSetStatus?.(u, !u.is_active)
                              }}
                            >
                              {u.is_active ? 'Suspend' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              className="flex w-full px-3 py-2 text-left text-xs font-medium text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                              onClick={() => {
                                setMenuUserId(null)
                                onRemoveUser?.(u)
                              }}
                            >
                              Move to recycle bin
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600 dark:text-gray-400">
        <p>
          Showing {(pageSafe - 1) * PAGE_SIZE + (filtered.length ? 1 : 0)} to{' '}
          {Math.min(pageSafe * PAGE_SIZE, filtered.length)} of {filtered.length} users
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={pageSafe <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900"
            aria-label="Previous page"
          >
            <FiChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let num = i + 1
            if (totalPages > 7 && pageSafe > 4) {
              num = pageSafe - 3 + i
              if (num > totalPages) num = totalPages - 6 + i
            }
            return (
              <button
                key={num}
                type="button"
                onClick={() => setPage(num)}
                className={`inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg border px-2 text-sm font-semibold ${
                  num === pageSafe
                    ? 'border-sky-200 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200'
                    : 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                }`}
              >
                {num}
              </button>
            )
          })}
          <button
            type="button"
            disabled={pageSafe >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900"
            aria-label="Next page"
          >
            <FiChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {profileUserId ? (
        <AdminUserProfilePanel
          userId={profileUserId}
          initialUser={profileUser}
          initialTab={profileTab}
          onClose={() => {
            setProfileUserId(null)
            setProfileUser(null)
          }}
          onEdit={(u) => {
            setProfileUserId(null)
            onEditUser?.(u)
          }}
          onRefreshList={load}
        />
      ) : null}
    </div>
  )
}
