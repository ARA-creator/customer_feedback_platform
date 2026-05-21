import { useEffect, useMemo, useState } from 'react'
import { FiArchive, FiKey, FiRefreshCw, FiRotateCcw, FiTrash2, FiUserX, FiUserCheck, FiUsers } from 'react-icons/fi'
import {
  adminApproveUser,
  adminCreateUser,
  adminDeleteUser,
  adminListRoles,
  adminListUsers,
  adminPurgeUser,
  adminRejectUser,
  adminRestoreUser,
  adminSetUserRoles,
  adminSetUserScope,
  adminSetUserStatus,
} from '../services/admin.api'
import AdminResetPasswordDialog from './AdminResetPasswordDialog'

export default function AdminUsers() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  /** @type {'active' | 'pending' | 'recycle'} */
  const [userScope, setUserScope] = useState('active')
  const [approveRoles, setApproveRoles] = useState({})
  const [resetUser, setResetUser] = useState(null)
  const [resetNotice, setResetNotice] = useState(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newUserRoles, setNewUserRoles] = useState(['agent'])

  const roleOptions = useMemo(() => roles.map((r) => r.name).sort(), [roles])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [u, r] = await Promise.all([adminListUsers({ scope: userScope }), adminListRoles()])
      setUsers(u?.users || [])
      setRoles(r?.roles || [])
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userScope])

  const createUser = async () => {
    setSaving(true)
    setError(null)
    try {
      await adminCreateUser({ email, password, roles: newUserRoles, primary_role: newUserRoles?.[0] })
      setEmail('')
      setPassword('')
      setNewUserRoles(['agent'])
      await load()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  const updateRoles = async (userId, rolesList) => {
    setSaving(true)
    setError(null)
    try {
      await adminSetUserRoles(userId, rolesList)
      await load()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to update roles')
    } finally {
      setSaving(false)
    }
  }

  const updateScope = async (userId, team, region) => {
    setSaving(true)
    setError(null)
    try {
      await adminSetUserScope(userId, { team, region })
      await load()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to update scope')
    } finally {
      setSaving(false)
    }
  }

  const setStatus = async (userId, isActive) => {
    setSaving(true)
    setError(null)
    try {
      await adminSetUserStatus(userId, { is_active: isActive })
      await load()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to update user status')
    } finally {
      setSaving(false)
    }
  }

  const approveUser = async (u) => {
    const role = approveRoles[u.id] || 'agent'
    setSaving(true)
    setError(null)
    try {
      await adminApproveUser(u.id, { roles: [role], primary_role: role })
      await load()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to approve user')
    } finally {
      setSaving(false)
    }
  }

  const rejectUser = async (u) => {
    const ok = window.confirm(`Reject access request for ${u.email}?`)
    if (!ok) return
    setSaving(true)
    setError(null)
    try {
      await adminRejectUser(u.id, {})
      await load()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to reject user')
    } finally {
      setSaving(false)
    }
  }

  const removeUser = async (u) => {
    const ok = window.confirm(
      `Move ${u?.email} to the recycle bin?\n\nThey will lose access immediately. You can restore them from Recycle bin unless they are permanently deleted.`
    )
    if (!ok) return
    setSaving(true)
    setError(null)
    try {
      await adminDeleteUser(u.id)
      await load()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to remove user')
    } finally {
      setSaving(false)
    }
  }

  const restoreUser = async (u) => {
    setSaving(true)
    setError(null)
    try {
      await adminRestoreUser(u.id)
      await load()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to restore user')
    } finally {
      setSaving(false)
    }
  }

  const purgeUser = async (u) => {
    const ok = window.confirm(
      `Permanently delete ${u?.email}?\n\nThis cannot be undone. The email can be used again for a new account.`
    )
    if (!ok) return
    setSaving(true)
    setError(null)
    try {
      await adminPurgeUser(u.id)
      await load()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to permanently delete user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200">
            <FiUsers className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Users</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage users and their roles. Backend enforces RBAC (least privilege).
            </p>
          </div>
          <div className="ml-auto">
            <button
              type="button"
              onClick={load}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        )}
        {resetNotice && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
            {resetNotice}
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Create user</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password (12+ chars)"
              className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
            <select
              value={newUserRoles[0] || 'agent'}
              onChange={(e) => setNewUserRoles([e.target.value])}
              className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              {roleOptions.length === 0 ? (
                <>
                  <option value="agent">agent</option>
                  <option value="team_lead">team_lead</option>
                  <option value="analyst">analyst</option>
                  <option value="cx_manager">cx_manager</option>
                  <option value="super_admin">super_admin</option>
                  <option value="auditor">auditor</option>
                </>
              ) : (
                roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={createUser}
              disabled={saving || !email.trim() || !password || password.length < 12}
              className="inline-flex min-h-[40px] items-center rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900"
            >
              {saving ? 'Saving…' : 'Create user'}
            </button>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Users</h2>
            <div
              className="inline-flex rounded-full border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-950"
              role="tablist"
              aria-label="User lists"
            >
              <button
                type="button"
                onClick={() => setUserScope('active')}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  userScope === 'active'
                    ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900'
                }`}
                aria-selected={userScope === 'active'}
                role="tab"
              >
                <FiUsers className="h-3.5 w-3.5" />
                Active
              </button>
              <button
                type="button"
                onClick={() => setUserScope('pending')}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  userScope === 'pending'
                    ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900'
                }`}
                aria-selected={userScope === 'pending'}
                role="tab"
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setUserScope('recycle')}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  userScope === 'recycle'
                    ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900'
                }`}
                aria-selected={userScope === 'recycle'}
                role="tab"
              >
                <FiArchive className="h-3.5 w-3.5" />
                Recycle bin
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {userScope === 'active'
              ? 'Removing a user moves them to the recycle bin (soft delete). They cannot sign in until restored.'
              : userScope === 'pending'
                ? 'External access requests awaiting approval. Assign a role when approving.'
                : 'Users here were removed from the active list. Restore to reinstate access, or permanently delete to free the email for a new signup.'}
          </p>
          {loading ? (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
          ) : userScope === 'pending' ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Requested</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {users.map((u) => (
                    <tr key={u.id} className="bg-white dark:bg-gray-950">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{u.email}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{u.full_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {u.created_at ? new Date(u.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={approveRoles[u.id] || 'agent'}
                          onChange={(e) =>
                            setApproveRoles((prev) => ({ ...prev, [u.id]: e.target.value }))
                          }
                          disabled={saving}
                          className="min-h-[40px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        >
                          {(roleOptions.length ? roleOptions : ['agent', 'cx_manager']).map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => approveUser(u)}
                            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60"
                          >
                            <FiUserCheck className="h-4 w-4" />
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => rejectUser(u)}
                            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900 hover:bg-rose-100 disabled:opacity-60"
                          >
                            <FiUserX className="h-4 w-4" />
                            Reject
                          </button>
                          {u.auth_provider !== 'azure_ad' && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => setResetUser(u)}
                              title="Reset password"
                              aria-label="Reset password"
                              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                            >
                              <FiKey className="h-4 w-4" />
                              Reset password
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No pending requests.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : userScope === 'active' ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Legacy role</th>
                    <th className="px-4 py-3">Roles</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3">Region</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {users.map((u) => (
                    <tr key={u.id} className="bg-white dark:bg-gray-950">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{u.email}</td>
                      <td className="px-4 py-3">
                        {u.is_active ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">Active</span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Suspended</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{u.role || '-'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={(u.roles && u.roles[0]) || u.role || 'agent'}
                          onChange={(e) => updateRoles(u.id, [e.target.value])}
                          disabled={saving}
                          className="min-h-[40px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        >
                          {(roleOptions.length ? roleOptions : ['agent', 'team_lead', 'analyst', 'cx_manager', 'super_admin', 'auditor']).map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          defaultValue={u.team || ''}
                          placeholder="e.g. AccraSupport"
                          disabled={saving}
                          onBlur={(e) => updateScope(u.id, e.target.value, u.region || '')}
                          className="min-h-[40px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          defaultValue={u.region || ''}
                          placeholder="e.g. Ghana"
                          disabled={saving}
                          onBlur={(e) => updateScope(u.id, u.team || '', e.target.value)}
                          className="min-h-[40px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 whitespace-nowrap flex-wrap">
                          {u.auth_provider !== 'azure_ad' && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => setResetUser(u)}
                              title="Reset password"
                              aria-label="Reset password"
                              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                            >
                              <FiKey className="h-4 w-4" />
                            </button>
                          )}
                          {u.is_active ? (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => setStatus(u.id, false)}
                              title="Suspend user"
                              aria-label="Suspend user"
                              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
                            >
                              <FiUserX className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => setStatus(u.id, true)}
                              title="Activate user"
                              aria-label="Activate user"
                              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                            >
                              <FiUserCheck className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => removeUser(u)}
                            title="Move to recycle bin"
                            aria-label="Move to recycle bin"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
                          >
                            <FiArchive className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No active users.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Removed</th>
                    <th className="px-4 py-3">Roles (last)</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {users.map((u) => (
                    <tr key={u.id} className="bg-white dark:bg-gray-950">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{u.email}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {u.deleted_at ? new Date(u.deleted_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {(u.roles && u.roles.length && u.roles.join(', ')) || u.role || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => restoreUser(u)}
                            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                          >
                            <FiRotateCcw className="h-4 w-4" />
                            Restore
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => purgeUser(u)}
                            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900 hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
                          >
                            <FiTrash2 className="h-4 w-4" />
                            Delete forever
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        Recycle bin is empty.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AdminResetPasswordDialog
        open={!!resetUser}
        user={resetUser}
        onClose={() => setResetUser(null)}
        onSuccess={() => {
          setResetNotice(`Password updated for ${resetUser?.email || 'user'}. Share the new password securely.`)
          setResetUser(null)
        }}
      />
    </div>
  )
}

