import { formatOtpCountdown } from '../utils/formatOtpTime'

export default function OtpCodeTimer({
  hasStarted,
  expiresIn,
  expired,
  progress,
  expirySeconds,
  resendIn,
  canResend,
  showResendHint = true,
}) {
  const pct = Math.round(progress * 100)
  const urgent = hasStarted && expiresIn > 0 && expiresIn <= Math.min(300, expirySeconds * 0.1)
  const barColor = expired ? 'bg-rose-500' : urgent ? 'bg-amber-500' : 'bg-[#009750]'

  const limitLabel =
    expirySeconds >= 3600
      ? `${Math.floor(expirySeconds / 3600)} hours`
      : `${Math.floor(expirySeconds / 60)} minutes`

  if (!hasStarted) {
    return (
      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-left" role="status">
        <p className="text-xs font-semibold text-gray-700">Time limit</p>
        <p className="mt-0.5 text-xs text-gray-500">
          You have <span className="font-semibold text-gray-800">{limitLabel}</span> to enter the code after it is
          sent.
        </p>
      </div>
    )
  }

  return (
    <div
      className={`mt-4 rounded-xl border px-3 py-3 text-left space-y-2 ${
        expired
          ? 'border-rose-200 bg-rose-50'
          : urgent
            ? 'border-amber-200 bg-amber-50'
            : 'border-emerald-200 bg-emerald-50/80'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-700">
          {expired ? 'Time limit reached' : 'Time remaining to enter code'}
        </span>
        <span
          className={`text-base font-bold tabular-nums ${
            expired ? 'text-rose-600' : urgent ? 'text-amber-700' : 'text-[#009750]'
          }`}
        >
          {expired ? '0:00' : formatOtpCountdown(expiresIn)}
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-white/80" aria-hidden>
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${barColor}`}
          style={{ width: `${expired ? 0 : pct}%` }}
        />
      </div>

      {expired ? (
        <p className="text-xs font-medium text-rose-700">
          This code can no longer be used. Request a new code to continue.
        </p>
      ) : (
        <p className="text-xs text-gray-600">
          Enter all 6 digits before <span className="font-semibold">{formatOtpCountdown(expiresIn)}</span> runs out.
        </p>
      )}

      {showResendHint && !expired && (
        <p className="text-xs text-gray-500 border-t border-gray-200/80 pt-2">
          {canResend ? (
            'Did not receive a code? Use Resend below.'
          ) : (
            <>
              Resend in{' '}
              <span className="font-semibold text-gray-700">{formatOtpCountdown(resendIn)}</span>
            </>
          )}
        </p>
      )}
    </div>
  )
}
