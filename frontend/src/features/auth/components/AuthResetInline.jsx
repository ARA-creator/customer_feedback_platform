import { useEffect, useState } from 'react'
import { FiEye, FiEyeOff } from 'react-icons/fi'
import AuthCodeCard from './AuthCodeCard'
import { authForgotPassword, authResetPassword } from '../services/auth.api'
import { OTP_EXPIRY_SECONDS, OTP_RESEND_COOLDOWN_SECONDS } from '../constants/otp'
import useOtpTimer from '../hooks/useOtpTimer'
import { formatOtpCountdown } from '../utils/formatOtpTime'

export default function AuthResetInline({
  email,
  onEmailChange,
  showEmailField,
  onBack,
  onSuccess,
  codeSent = false,
}) {
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const normalizedEmail = email.trim().toLowerCase()

  const {
    hasStarted,
    expired,
    canResend,
    resendIn,
    markSent,
    expiresIn,
    progress,
    expirySeconds,
  } = useOtpTimer({
    purpose: 'reset',
    email: normalizedEmail,
    expirySeconds: OTP_EXPIRY_SECONDS.reset,
    resendCooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    active: !!normalizedEmail,
    autoStart: !!normalizedEmail,
  })

  useEffect(() => {
    if (codeSent && normalizedEmail) {
      markSent()
    }
  }, [codeSent, normalizedEmail, markSent])

  useEffect(() => {
    if (!expired) return
    setCode('')
    setPw('')
    setError('This code has expired. Request a new code below.')
  }, [expired])

  const codeComplete = code.replace(/\D/g, '').length === 6
  const canConfirm = normalizedEmail && codeComplete && pw.length >= 12 && hasStarted && !expired
  const canRequestResend = normalizedEmail && (expired || !hasStarted || canResend)

  const submit = async () => {
    if (!canConfirm) return
    setLoading(true)
    setError(null)
    try {
      await authResetPassword({
        email: normalizedEmail,
        code: code.replace(/\D/g, ''),
        password: pw,
      })
      onSuccess?.()
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Reset failed.')
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    if (!canRequestResend) return
    setLoading(true)
    setError(null)
    try {
      await authForgotPassword({ email: normalizedEmail })
      markSent()
      setCode('')
      setPw('')
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not resend code.')
    } finally {
      setLoading(false)
    }
  }

  const resendLabel =
    canResend || !hasStarted || expired ? 'Resend' : `Resend in ${formatOtpCountdown(resendIn)}`

  return (
    <AuthCodeCard
      title="Verification Code"
      description={`Enter the reset code sent to ${normalizedEmail || 'your email'}, then choose a new password.`}
      email={email}
      onEmailChange={onEmailChange}
      showEmailField={showEmailField ?? !normalizedEmail}
      code={code}
      onCodeChange={setCode}
      loading={loading}
      error={error}
      timer={{
        hasStarted,
        expiresIn,
        expired,
        progress,
        expirySeconds,
        resendIn,
        canResend: canResend || expired,
        showResendHint: true,
      }}
      primaryLabel={codeComplete ? 'Confirm Code' : resendLabel}
      primaryVariant={codeComplete ? 'confirm' : 'resend'}
      primaryDisabled={codeComplete ? !canConfirm : !canRequestResend}
      onPrimary={codeComplete ? submit : resend}
      secondaryLabel="Back to sign in"
      onSecondary={onBack}
    >
      {codeComplete && !expired && (
        <div className="mt-5 text-left">
          <label htmlFor="inline-reset-password" className="block text-xs font-semibold text-gray-700 mb-1">
            New password
          </label>
          <div className="relative">
            <input
              id="inline-reset-password"
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="At least 12 characters"
              autoComplete="new-password"
              disabled={loading}
              className="w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#009750]/40"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md text-gray-500 hover:bg-gray-50"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </AuthCodeCard>
  )
}
