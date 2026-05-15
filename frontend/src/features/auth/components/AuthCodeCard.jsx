import { FiMail } from 'react-icons/fi'
import OtpCodeInput from '../../../shared/components/ui/OtpCodeInput'
import OtpCodeTimer from './OtpCodeTimer'

export default function AuthCodeCard({
  title = 'Verification Code',
  description,
  email,
  onEmailChange,
  showEmailField = true,
  code,
  onCodeChange,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryVariant = 'confirm',
  secondaryLabel,
  onSecondary,
  loading = false,
  error,
  timer,
}) {
  const codeComplete = String(code || '').replace(/\D/g, '').length === 6
  const isResend = primaryVariant === 'resend'
  const confirmBlocked = !isResend && (!timer?.hasStarted || timer?.expired)

  return (
    <div className="text-center">
      <div
        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border-2 ${
          codeComplete ? 'border-[#009750] bg-emerald-50' : 'border-gray-200 bg-gray-50'
        }`}
      >
        <FiMail
          className={`h-8 w-8 ${codeComplete ? 'text-[#009750]' : 'text-gray-400'}`}
          aria-hidden
        />
      </div>

      <h2 className="mt-6 text-xl font-bold text-gray-900">{title}</h2>
      {description && (
        <p className="mt-2 text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">{description}</p>
      )}

      {showEmailField && (
        <div className="mt-5 text-left">
          <label htmlFor="auth-code-email" className="block text-xs font-semibold text-gray-700 mb-1">
            Email
          </label>
          <input
            id="auth-code-email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange?.(e.target.value)}
            placeholder="name@enterprise-life.com"
            autoComplete="email"
            disabled={loading}
            className="w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#009750]/40 focus:border-[#009750]/40 disabled:opacity-60"
          />
        </div>
      )}

      {!showEmailField && email && (
        <p className="mt-3 text-sm text-gray-600">
          Code sent to <span className="font-semibold text-gray-900">{email}</span>
        </p>
      )}

      <div className="mt-6 flex justify-center">
        <OtpCodeInput
          value={code}
          onChange={onCodeChange}
          disabled={loading || timer?.expired || !timer?.hasStarted}
          idPrefix="auth-code"
        />
      </div>

      {timer && <OtpCodeTimer {...timer} />}

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 text-left">
          {error}
        </div>
      )}

      {children}

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled || loading || confirmBlocked}
          className={`inline-flex w-full min-h-[44px] items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            isResend
              ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
              : 'bg-[#009750] hover:bg-[#007a42] focus:ring-[#009750]'
          }`}
        >
          {loading ? 'Please wait…' : primaryLabel}
        </button>

        {secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            disabled={loading}
            className="inline-flex w-full min-h-[44px] items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#009750]/30"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  )
}

