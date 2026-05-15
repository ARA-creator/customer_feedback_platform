import { useEffect, useState } from 'react'
import { FiMail } from 'react-icons/fi'
import { authResendVerification } from '../services/auth.api'
import { OTP_RESEND_COOLDOWN_SECONDS } from '../constants/otp'
import useOtpTimer from '../hooks/useOtpTimer'
import { formatOtpCountdown } from '../utils/formatOtpTime'

export default function AuthVerifyEmailPrompt({
  email,
  onEnterCode,
  onBack,
  codeSent = false,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resent, setResent] = useState(false)

  const normalizedEmail = email.trim().toLowerCase()

  const { hasStarted, canResend, resendIn, markSent } = useOtpTimer({
    purpose: 'verify',
    email: normalizedEmail,
    expirySeconds: 24 * 60 * 60,
    resendCooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    active: !!normalizedEmail,
    autoStart: !!normalizedEmail,
  })

  useEffect(() => {
    if (codeSent && normalizedEmail) {
      markSent()
    }
  }, [codeSent, normalizedEmail, markSent])

  const canResendNow = normalizedEmail && (!hasStarted || canResend)

  const resend = async () => {
    if (!canResendNow || loading) return
    setLoading(true)
    setError(null)
    setResent(false)
    try {
      await authResendVerification({ email: normalizedEmail })
      markSent()
      setResent(true)
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not resend email.')
    } finally {
      setLoading(false)
    }
  }

  const resendLabel =
    canResendNow || !hasStarted
      ? 'Resend Verification Email'
      : `Resend in ${formatOtpCountdown(resendIn)}`

  return (
    <div className="text-center">
      <div className="relative mx-auto h-[72px] w-[72px]">
        <div
          className="absolute inset-0 rounded-full bg-emerald-400/30 blur-2xl"
          aria-hidden
        />
        <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full border border-emerald-100/80 bg-gradient-to-b from-emerald-50 to-white shadow-sm">
          <FiMail className="h-8 w-8 text-[#009750]" aria-hidden />
        </div>
      </div>

      <h2 className="mt-8 text-2xl font-bold tracking-tight text-slate-900">
        Please verify your email
      </h2>

      <div className="mt-5 space-y-4 text-sm leading-relaxed text-slate-700 max-w-sm mx-auto">
        <p>You&apos;re almost there! We sent an email to</p>
        <p className="font-bold text-slate-900 text-base break-all">
          {normalizedEmail || 'your email address'}
        </p>
        <p>
          Open that email and enter the <span className="font-semibold text-slate-900">6-digit code</span>{' '}
          to complete your signup. If you don&apos;t see it, you may need to{' '}
          <span className="font-semibold text-slate-900">check your spam folder.</span>
        </p>
        <p>Still can&apos;t find the email? No problem.</p>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 text-left">
          {error}
        </div>
      )}
      {resent && !error && (
        <p className="mt-5 text-sm font-medium text-emerald-800">
          Verification email sent. Check your inbox.
        </p>
      )}

      <button
        type="button"
        onClick={resend}
        disabled={loading || !canResendNow}
        className="mt-8 inline-flex w-full min-h-[48px] items-center justify-center rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-slate-800 disabled:opacity-55 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 transition-transform active:scale-[0.98]"
      >
        {loading ? 'Sending…' : resendLabel}
      </button>

      {onEnterCode && (
        <p className="mt-5">
          <button
            type="button"
            onClick={onEnterCode}
            className="text-sm font-semibold text-[#009750] hover:text-[#007a42]"
          >
            I have my code — enter it now
          </button>
        </p>
      )}

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mt-6 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          Back to sign in
        </button>
      )}
    </div>
  )
}
