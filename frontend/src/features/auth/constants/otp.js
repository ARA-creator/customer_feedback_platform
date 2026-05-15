/** Must match backend `timedelta` in `backend/app/routes/api/auth.py`. */
export const OTP_EXPIRY_SECONDS = {
  reset: 15 * 60,
  verify: 24 * 60 * 60,
}

/** Minimum wait before requesting another code. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60

export function otpStorageKey(purpose, email) {
  const normalized = String(email || '')
    .trim()
    .toLowerCase()
  return `customer_pulse_otp_${purpose}_${normalized}`
}
