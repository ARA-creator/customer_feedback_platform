import { useMemo, useState } from 'react'
import { FiEye, FiEyeOff, FiLock, FiX } from 'react-icons/fi'
import { authResetPassword } from '../services/auth.api'

function PasswordField({ id, label, value, onChange, show, onToggleShow, autoComplete, disabled }) {
  return (
    <div className="text-left">
      <label htmlFor={id} className="block text-xs font-semibold text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder="At least 12 characters"
          autoComplete={autoComplete}
          disabled={disabled}
          className="w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#009750]/40 focus:border-[#009750]/40 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md text-gray-500 hover:bg-gray-50"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

export default function ResetPasswordDialog({ open, email, code, onClose, onSuccess }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const normalizedEmail = email.trim().toLowerCase()
  const digits = code.replace(/\D/g, '')

  const strengthHint = useMemo(() => {
    if (!password) return 'Use at least 12 characters.'
    if (password.length < 12) return 'Too short — use at least 12 characters.'
    return 'Looks good.'
  }, [password])

  const canSubmit =
    password.length >= 12 &&
    confirmPassword.length > 0 &&
    password === confirmPassword &&
    !loading

  const handleClose = () => {
    if (loading) return
    setPassword('')
    setConfirmPassword('')
    setError(null)
    onClose?.()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      await authResetPassword({
        email: normalizedEmail,
        code: digits,
        password,
      })
      setPassword('')
      setConfirmPassword('')
      onSuccess?.()
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not update password.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-password-dialog-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close dialog backdrop"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#009750]/10 border border-emerald-200">
              <FiLock className="h-5 w-5 text-[#009750]" aria-hidden />
            </span>
            <div>
              <h2 id="reset-password-dialog-title" className="text-lg font-semibold text-gray-900">
                Set new password
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">Code verified for {normalizedEmail}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50"
            aria-label="Close"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <PasswordField
            id="reset-dialog-password"
            label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            show={showPassword}
            onToggleShow={() => setShowPassword((s) => !s)}
            autoComplete="new-password"
            disabled={loading}
          />
          <p className="text-[11px] text-gray-500 -mt-2">{strengthHint}</p>

          <PasswordField
            id="reset-dialog-confirm-password"
            label="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            show={showConfirm}
            onToggleShow={() => setShowConfirm((s) => !s)}
            autoComplete="new-password"
            disabled={loading}
          />

          {confirmPassword.length > 0 && password !== confirmPassword && (
            <p className="text-xs text-rose-700">Passwords do not match.</p>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#009750] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#007a42] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#009750] focus:ring-offset-2"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
