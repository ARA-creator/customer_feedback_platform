import { useState } from 'react'
import { FiCheckCircle, FiXCircle } from 'react-icons/fi'
import { authVerifyEmail } from '../../features/auth/services/auth.api'
import { ToastStack } from '../../shared/components/ui'

export default function VerifyEmailPage({ onDone }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [state, setState] = useState({ status: 'idle', error: null })
  const [toasts, setToasts] = useState([])

  const submit = async (e) => {
    e.preventDefault()
    setState({ status: 'loading', error: null })
    try {
      await authVerifyEmail({ email: email.trim().toLowerCase(), code: code.trim() })
      setState({ status: 'ok', error: null })
      setToasts((t) => [
        { id: `${Date.now()}-verify`, type: 'success', title: 'Verified', message: 'Email confirmed successfully.', ttlMs: 3500 },
        ...t,
      ])
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Verification failed.'
      setState({ status: 'error', error: msg })
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 mx-auto max-w-lg">
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
      <div className="card p-6 bg-white/60 backdrop-blur-md dark:bg-gray-950/25">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
          Email verification
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Enter the 6-digit code sent to your email.
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

          <button
            type="submit"
            disabled={state.status === 'loading' || !email.trim() || code.trim().length !== 6}
            className="inline-flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#009750] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#007a42] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#009750]/30"
          >
            {state.status === 'loading' ? 'Verifying…' : 'Verify email'}
          </button>
        </form>
        {state.status === 'ok' && (
          <div className="mt-4 flex items-start gap-3">
            <FiCheckCircle className="h-5 w-5 text-emerald-600" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Verified.
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                You can now continue to the app.
              </p>
            </div>
          </div>
        )}
        {state.status === 'error' && (
          <div className="mt-4 flex items-start gap-3">
            <FiXCircle className="h-5 w-5 text-rose-600" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Couldn’t verify.
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{state.error}</p>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onDone?.()}
            className="inline-flex min-h-[44px] items-center rounded-xl bg-[#009750] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#007a42] focus:outline-none focus:ring-2 focus:ring-[#009750]/30"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

