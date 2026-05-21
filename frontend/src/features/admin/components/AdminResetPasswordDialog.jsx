import { useMemo, useState } from 'react'
import { FiEye, FiEyeOff, FiKey, FiX } from 'react-icons/fi'
import { adminResetUserPassword } from '../services/admin.api'

function PasswordField({ id, label, value, onChange, show, onToggleShow, disabled }) {
  return (
    <div className="text-left">
      <label htmlFor={id} className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder="At least 12 characters"
          autoComplete="new-password"
          disabled={disabled}
          className="w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#009750]/40 focus:border-[#009750]/40 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

export default function AdminResetPasswordDialog({ open, user, onClose, onSuccess }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const strengthHint = useMemo(() => {
    if (!password) return 'Use at least 12 characters.'
    if (password.length < 12) return 'Too short — use at least 12 characters.'
    return 'Looks good.'
  }, [password])

  const canSubmit =
    password.length >= 12 && confirmPassword.length >= 12 && password === confirmPassword && !loading

  const handleClose = () => {
    if (loading) return
    setPassword('')
    setConfirmPassword('')
    setError(null)
    onClose?.()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user?.id || !canSubmit) return
    setLoading(true)
    setError(null)
    try {
      await adminResetUserPassword(user.id, { password, confirm_password: confirmPassword })
      setPassword('')
      setConfirmPassword('')
      onSuccess?.()
      onClose?.()
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not reset password.')
    } finally {
      setLoading(false)
    }
  }

  if (!open || !user) return null

  const isEnterprise = user.auth_provider === 'azure_ad'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-reset-password-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-950">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#009750]/10 text-[#009750]">
              <FiKey className="h-5 w-5" />
            </div>
            <div>
              <h2 id="admin-reset-password-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Reset password
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[16rem]">{user.email}</p>
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

        {isEnterprise ? (
          <p className="mt-4 text-sm text-amber-800 dark:text-amber-200">
            This account uses Enterprise SSO. Password cannot be set here; the user must sign in with Microsoft.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Set a new password for this user. They will use it on the external login path. Share it securely.
            </p>
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
                {error}
              </div>
            )}
            <PasswordField
              id="admin-reset-password"
              label="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              show={showPassword}
              onToggleShow={() => setShowPassword((s) => !s)}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">{strengthHint}</p>
            <PasswordField
              id="admin-reset-confirm"
              label="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              show={showConfirm}
              onToggleShow={() => setShowConfirm((s) => !s)}
              disabled={loading}
            />
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-xs text-rose-600 dark:text-rose-300">Passwords do not match.</p>
            )}
            <div className="flex gap-2 pt-2">
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
                disabled={!canSubmit}
                className="flex-1 min-h-[44px] rounded-lg bg-[#009750] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Update password'}
              </button>
            </div>
          </form>
        )}

        {isEnterprise && (
          <button
            type="button"
            onClick={handleClose}
            className="mt-4 w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            Close
          </button>
        )}
      </div>
    </div>
  )
}
