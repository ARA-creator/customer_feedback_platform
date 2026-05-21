import { useEffect, useMemo, useState } from 'react'
import { FiEdit2, FiKey, FiX } from 'react-icons/fi'
import { adminUpdateUser } from '../services/admin.api'

export default function AdminEditUserDialog({
  open,
  user,
  roleOptions = [],
  onClose,
  onSuccess,
  onResetPassword,
}) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('agent')
  const [team, setTeam] = useState('')
  const [region, setRegion] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isEnterprise = user?.auth_provider === 'azure_ad'
  const isPending = Boolean(user?.pending_approval)
  const roles = useMemo(
    () => (roleOptions.length ? roleOptions : ['agent', 'team_lead', 'analyst', 'cx_manager', 'super_admin', 'auditor']),
    [roleOptions]
  )

  useEffect(() => {
    if (!open || !user) return
    setEmail(user.email || '')
    setFullName(user.full_name || '')
    setRole((user.roles && user.roles[0]) || user.role || 'agent')
    setTeam(user.team || '')
    setRegion(user.region || '')
    setIsActive(user.is_active !== false)
    setError(null)
  }, [open, user])

  const handleClose = () => {
    if (loading) return
    setError(null)
    onClose?.()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      const payload = {
        full_name: fullName.trim() || null,
        roles: [role],
        primary_role: role,
        team: team.trim() || null,
        region: region.trim() || null,
      }
      if (!isEnterprise) {
        payload.email = email.trim().toLowerCase()
      }
      if (!isPending) {
        payload.is_active = isActive
      }
      await adminUpdateUser(user.id, payload)
      onSuccess?.()
      onClose?.()
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not save user.')
    } finally {
      setLoading(false)
    }
  }

  if (!open || !user) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-edit-user-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-950">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200">
              <FiEdit2 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="admin-edit-user-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Edit user
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isPending ? 'Pending access request' : user.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
              {error}
            </div>
          )}

          {isEnterprise && (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Enterprise SSO account — email is managed by Microsoft. You can still update name, role, and scope here.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="admin-edit-email" className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                Email
              </label>
              <input
                id="admin-edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || isEnterprise}
                required={!isEnterprise}
                className="w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="admin-edit-name" className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                Full name
              </label>
              <input
                id="admin-edit-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                placeholder="Optional"
                className="w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            <div>
              <label htmlFor="admin-edit-role" className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                Role
              </label>
              <select
                id="admin-edit-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={loading}
                className="w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            {!isPending && (
              <div className="flex items-end">
                <label className="flex min-h-[44px] w-full cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    disabled={loading}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100">Account active</span>
                </label>
              </div>
            )}
            <div>
              <label htmlFor="admin-edit-team" className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                Team
              </label>
              <input
                id="admin-edit-team"
                type="text"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                disabled={loading}
                placeholder="e.g. AccraSupport"
                className="w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            <div>
              <label htmlFor="admin-edit-region" className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                Region
              </label>
              <input
                id="admin-edit-region"
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                disabled={loading}
                placeholder="e.g. Ghana"
                className="w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 min-h-[44px] rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (!isEnterprise && !email.trim())}
              className="flex-1 min-h-[44px] rounded-lg bg-[#009750] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Save changes'}
            </button>
          </div>

          {!isEnterprise && onResetPassword && (
            <button
              type="button"
              onClick={() => {
                onClose?.()
                onResetPassword(user)
              }}
              className="w-full inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              <FiKey className="h-4 w-4" />
              Reset password…
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
