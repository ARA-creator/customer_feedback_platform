import { useEffect, useState } from 'react'
import AuthCodeCard from './AuthCodeCard'
import { authResendVerification, authVerifyEmail } from '../services/auth.api'
import { OTP_EXPIRY_SECONDS, OTP_RESEND_COOLDOWN_SECONDS } from '../constants/otp'
import useOtpTimer from '../hooks/useOtpTimer'
import { formatOtpCountdown } from '../utils/formatOtpTime'

export default function AuthVerifyInline({
  email,
  onEmailChange,
  showEmailField,
  onBack,
  onSuccess,
  codeSent = false,
  secondaryLabel = 'Back to sign in',
}) {
  const [code, setCode] = useState('')
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
    purpose: 'verify',
    email: normalizedEmail,
    expirySeconds: OTP_EXPIRY_SECONDS.verify,
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
    setError('This verification code has expired. Resend a code below.')
  }, [expired])

  const codeComplete = code.replace(/\D/g, '').length === 6
  const canRequestResend = normalizedEmail && (expired || !hasStarted || canResend)
  const canConfirm = normalizedEmail && codeComplete && hasStarted && !expired && !loading

  const resend = async () => {
    if (!canRequestResend) return
    setLoading(true)
    setError(null)
    try {
      await authResendVerification({ email: normalizedEmail })
      markSent()
      setCode('')
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not resend code.')
    } finally {
      setLoading(false)
    }
  }

  const resendLinkLabel =
    canResend || !hasStarted || expired
      ? 'Resend code'
      : `Resend code in ${formatOtpCountdown(resendIn)}`

  const submit = async () => {
    if (!canConfirm) return
    setLoading(true)
    setError(null)
    try {
      await authVerifyEmail({ email: normalizedEmail, code: code.replace(/\D/g, '') })
      onSuccess?.()
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Verification failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCodeCard
      title="Verify your email"
      description={`Enter the 6-digit code we sent to ${normalizedEmail || 'your email'}.`}
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
        showResendHint: false,
      }}
      primaryLabel="Verify Code"
      primaryVariant="confirm"
      primaryDisabled={!canConfirm}
      onPrimary={submit}
      secondaryLabel={secondaryLabel}
      onSecondary={onBack}
      helperLinkLabel={resendLinkLabel}
      onHelperLink={resend}
      helperLinkDisabled={!canRequestResend}
    />
  )
}
