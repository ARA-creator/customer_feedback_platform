import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiEye, FiEyeOff } from 'react-icons/fi'
import { authChangePassword } from '../../features/auth/services/auth.api'
import { ToastStack } from '../../shared/components/ui'

function PasswordField({ id, label, value, onChange, show, onToggle, autoComplete }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          className="w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#009750]/40 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

export default function SettingsSecurityPage({ auth }) {
  const isEnterprise = auth?.auth_provider === 'azure_ad'

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [toasts, setToasts] = useState([])

  const canSubmit =
    !isEnterprise &&
    currentPassword.length > 0 &&
    newPassword.length >= 12 &&
    confirmPassword.length > 0 &&
    newPassword === confirmPassword &&
    !loading

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await authChangePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Your password was updated successfully.')
      setToasts((t) => [
        {
          id: `${Date.now()}-pw`,
          type: 'success',
          title: 'Password updated',
          message: 'Use your new password next time you sign in.',
          ttlMs: 4000,
        },
        ...t,
      ])
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Could not update password.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />

      <Link
        to="/settings"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <FiArrowLeft className="h-4 w-4" aria-hidden />
        Settings
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Security</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Manage how you sign in to Customer Pulse.</p>
      </div>

      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Password</h2>

        {isEnterprise ? (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            Your account uses Enterprise sign-in with Microsoft. Password changes are managed by your organization —
            use “I have an Enterprise email” on the sign-in page.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Use at least 12 characters. You will stay signed in after updating.
            </p>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <PasswordField
                id="security-current-password"
                label="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                show={showCurrent}
                onToggle={() => setShowCurrent((s) => !s)}
                autoComplete="current-password"
              />
              <PasswordField
                id="security-new-password"
                label="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                show={showNew}
                onToggle={() => setShowNew((s) => !s)}
                autoComplete="new-password"
              />
              <PasswordField
                id="security-confirm-password"
                label="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                show={showConfirm}
                onToggle={() => setShowConfirm((s) => !s)}
                autoComplete="new-password"
              />

              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="text-xs text-rose-700 dark:text-rose-300">New passwords do not match.</p>
              )}

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex w-full min-h-[44px] items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
