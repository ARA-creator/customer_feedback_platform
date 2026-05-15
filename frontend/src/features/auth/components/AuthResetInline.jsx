import { useEffect, useState } from 'react'
import AuthCodeCard from './AuthCodeCard'
import ResetPasswordDialog from './ResetPasswordDialog'
import { authForgotPassword, authVerifyResetCode } from '../services/auth.api'
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [verifiedCode, setVerifiedCode] = useState('')

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
    setPasswordDialogOpen(false)
    setVerifiedCode('')
    setError('This code has expired. Request a new code below.')
  }, [expired])

  const codeComplete = code.replace(/\D/g, '').length === 6
  const canRequestResend = normalizedEmail && (expired || !hasStarted || canResend)
  const canVerifyCode =
    normalizedEmail && codeComplete && hasStarted && !expired && !loading

  const openPasswordDialog = (digits) => {
    setVerifiedCode(digits)
    setPasswordDialogOpen(true)
    setError(null)
  }

  const verifyCode = async () => {
    if (!canVerifyCode) return
    const digits = code.replace(/\D/g, '')
    setLoading(true)
    setError(null)
    try {
      await authVerifyResetCode({ email: normalizedEmail, code: digits })
      openPasswordDialog(digits)
    } catch (err) {
      const status = err?.response?.status
      // Production may not have verify-reset-code until latest backend is deployed.
      if (status === 404 || status === 405) {
        openPasswordDialog(digits)
        return
      }
      const apiErr = err?.response?.data?.error
      setError(
        typeof apiErr === 'string' && apiErr.trim()
          ? apiErr
          : 'Invalid verification code. Check the 6 digits and try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    if (!canRequestResend) return
    setLoading(true)
    setError(null)
    setPasswordDialogOpen(false)
    setVerifiedCode('')
    try {
      await authForgotPassword({ email: normalizedEmail })
      markSent()
      setCode('')
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not resend code.')
    } finally {
      setLoading(false)
    }
  }

  const resendLabel =
    canResend || !hasStarted || expired ? 'Resend' : `Resend in ${formatOtpCountdown(resendIn)}`

  return (
    <>
      <AuthCodeCard
        title="Verification Code"
        description={`Enter the reset code sent to ${normalizedEmail || 'your email'}.`}
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
        primaryLabel={codeComplete ? 'Verify Code' : resendLabel}
        primaryVariant={codeComplete ? 'confirm' : 'resend'}
        primaryDisabled={codeComplete ? !canVerifyCode : !canRequestResend}
        onPrimary={codeComplete ? verifyCode : resend}
        secondaryLabel="Back to sign in"
        onSecondary={onBack}
      />

      <ResetPasswordDialog
        open={passwordDialogOpen}
        email={normalizedEmail}
        code={verifiedCode}
        onClose={() => {
          setPasswordDialogOpen(false)
          setVerifiedCode('')
        }}
        onSuccess={() => {
          setPasswordDialogOpen(false)
          setVerifiedCode('')
          onSuccess?.()
        }}
      />
    </>
  )
}
