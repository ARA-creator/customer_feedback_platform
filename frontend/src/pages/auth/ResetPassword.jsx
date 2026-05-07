import { useState } from 'react'
import { FiCheckCircle, FiEye, FiEyeOff, FiXCircle } from 'react-icons/fi'
import { authResetPassword } from '../../features/auth/services/auth.api'
import { ToastStack } from '../../shared/components/ui'

export default function ResetPasswordPage({ onDone }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [state, setState] = useState({ status: 'idle', error: null })
  const [toasts, setToasts] = useState([])

  const submit = async (e) => {
    e.preventDefault()
    setState({ status: 'loading', error: null })
    try {
      await authResetPassword({ email: email.trim().toLowerCase(), code: code.trim(), password: pw })
      setState({ status: 'ok', error: null })
      setToasts((t) => [
        { id: `${Date.now()}-reset`, type: 'success', title: 'Password updated', message: 'You can sign in now.', ttlMs: 3500 },
        ...t,
      ])
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Reset failed.'
      setState({ status: 'error', error: msg })
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 mx-auto max-w-lg">
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
      <div className="card p-6 bg-white/60 backdrop-blur-md dark:bg-gray-950/25">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
          Reset password
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Enter the 6-digit reset code sent to your email, then choose a new password (12+ characters).
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-sm text-gray-900 shadow-sm backdrop-blur-md placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#009750]/30 dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-100"
            autoComplete="email"
            required
          />
          <input
            inputMode="numeric"
            pattern="[0-9]{6}"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit code"
            className="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-sm text-gray-900 shadow-sm backdrop-blur-md placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#009750]/30 dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-100 tracking-[0.28em] text-center"
            required
          />
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="New password"
              className="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-sm text-gray-900 shadow-sm backdrop-blur-md placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#009750]/30 dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-gray-500 hover:bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#009750]/25 dark:hover:bg-gray-950/40"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={!email.trim() || code.trim().length !== 6 || pw.length < 12 || state.status === 'loading'}
            className="inline-flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#009750] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#007a42] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#009750]/30"
          >
            {state.status === 'loading' ? 'Resetting…' : 'Reset password'}
          </button>
        </form>

        {state.status === 'ok' && (
          <div className="mt-4 flex items-start gap-3">
            <FiCheckCircle className="h-5 w-5 text-emerald-600" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Password updated.
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                You can now sign in with your new password.
              </p>
            </div>
          </div>
        )}
        {state.status === 'error' && state.error && (
          <div className="mt-4 flex items-start gap-3">
            <FiXCircle className="h-5 w-5 text-rose-600" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Couldn’t reset.
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{state.error}</p>
            </div>
          </div>
        )}

        <div className="mt-6">
          <button
            type="button"
            onClick={() => onDone?.()}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-gray-200 bg-white/70 px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm backdrop-blur-md hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#009750]/20 dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-100"
          >
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  )
}

