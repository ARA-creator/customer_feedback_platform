import { useEffect, useState } from 'react'
import AuthCodeCard from './AuthCodeCard'
import { authVerifyEmail } from '../services/auth.api'
import { OTP_EXPIRY_SECONDS } from '../constants/otp'
import useOtpTimer from '../hooks/useOtpTimer'

export default function AuthVerifyInline({
  email,
  onEmailChange,
  showEmailField,
  onBack,
  onSuccess,
  codeSent = false,
}) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const normalizedEmail = email.trim().toLowerCase()

  const { hasStarted, expired, expiresIn, progress, expirySeconds, markSent } = useOtpTimer({
    purpose: 'verify',
    email: normalizedEmail,
    expirySeconds: OTP_EXPIRY_SECONDS.verify,
    resendCooldownSeconds: 0,
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
    setError('This verification code has expired. Sign up again or contact your administrator.')
  }, [expired])

  const codeComplete = code.replace(/\D/g, '').length === 6
  const canConfirm = normalizedEmail && codeComplete && hasStarted && !expired

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
      title="Verification Code"
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
        resendIn: 0,
        canResend: false,
        showResendHint: false,
      }}
      primaryLabel="Confirm Code"
      primaryVariant="confirm"
      primaryDisabled={!canConfirm}
      onPrimary={submit}
      secondaryLabel="Back to sign in"
      onSecondary={onBack}
    />
  )
}
