import { useCallback, useEffect, useState } from 'react'
import { otpStorageKey } from '../constants/otp'

function readSentAt(key) {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(key)
  if (!raw) return null
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms : null
}

/**
 * Tracks code expiry and resend cooldown from the moment a code was sent.
 * Persists `sentAt` in sessionStorage per purpose + email.
 */
export default function useOtpTimer({
  purpose,
  email,
  expirySeconds,
  resendCooldownSeconds = 60,
  active = true,
  /** Start the input window when the code screen opens (if none is stored yet). */
  autoStart = false,
}) {
  const key = otpStorageKey(purpose, email)

  const [sentAt, setSentAt] = useState(() => (active ? readSentAt(key) : null))
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return undefined
    setSentAt(readSentAt(key))
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active, key])

  useEffect(() => {
    if (!active || !email || !autoStart) return
    if (readSentAt(key) != null) return
    const ts = Date.now()
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(key, new Date(ts).toISOString())
    }
    setSentAt(ts)
    setNow(ts)
  }, [active, autoStart, email, key])

  const markSent = useCallback(() => {
    const ts = Date.now()
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(key, new Date(ts).toISOString())
    }
    setSentAt(ts)
    setNow(ts)
  }, [key])

  const clearSent = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(key)
    }
    setSentAt(null)
  }, [key])

  const hasStarted = sentAt != null
  const expiresAt = hasStarted ? sentAt + expirySeconds * 1000 : null
  const resendAt = hasStarted ? sentAt + resendCooldownSeconds * 1000 : null

  const expiresIn = expiresAt != null ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : expirySeconds
  const resendIn = resendAt != null ? Math.max(0, Math.ceil((resendAt - now) / 1000)) : 0

  const expired = hasStarted && expiresIn <= 0
  const canResend = hasStarted ? resendIn <= 0 : false
  const progress = hasStarted ? Math.min(1, Math.max(0, expiresIn / expirySeconds)) : 1

  return {
    hasStarted,
    expiresIn,
    resendIn,
    expired,
    canResend,
    progress,
    markSent,
    clearSent,
    expirySeconds,
  }
}
