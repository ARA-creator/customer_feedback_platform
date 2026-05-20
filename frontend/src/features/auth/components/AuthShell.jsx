import { useEffect, useMemo, useState } from 'react'
import { FiEye, FiEyeOff } from 'react-icons/fi'
import { authLogin, authMe, authSignup } from '../services/auth.api'
import { ToastStack } from '../../../shared/components/ui'
import AuthGate from './AuthGate'

function FieldLabel({ children }) {
  return <label className="block text-xs font-semibold text-gray-700 mb-1">{children}</label>
}

function TextInput({ ...props }) {
  return (
    <input
      {...props}
      className={`w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/40 focus:border-[#009750]/40 ${
        props.className || ''
      }`}
    />
  )
}

function PasswordInput({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <TextInput
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md text-gray-500 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009750]/40"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export default function AuthShell({ onAuthenticated }) {
  const [step, setStep] = useState('gate') // gate | external
  const [mode, setMode] = useState('login')
  const isSignup = mode === 'signup'

  const [info, setInfo] = useState(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('enterprise_signed_in') === '1') {
      authMe()
        .then((data) => {
          if (data?.authenticated && data?.user) {
            onAuthenticated?.(data.user)
          }
        })
        .catch(() => {})
      window.history.replaceState({}, '', window.location.pathname)
    }
    const entErr = params.get('enterprise_error')
    if (entErr) {
      setStep('gate')
      setError(decodeURIComponent(entErr))
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [onAuthenticated])

  const formatApiErrorMessage = (err, fallback) => {
    const apiErr = err?.response?.data?.error
    if (typeof apiErr === 'string' && apiErr.trim()) return apiErr
    const msg = err?.message
    if (typeof msg === 'string' && msg.trim()) return msg
    return fallback
  }

  const strengthHint = useMemo(() => {
    const len = password.length
    if (!isSignup) return null
    if (!password) return 'Use at least 12 characters…'
    if (len < 12) return 'Good start — 12+ characters is recommended.'
    return 'Looks good.'
  }, [password, isSignup])

  const canSubmit = useMemo(() => {
    const hasEmail = email.trim().length > 2
    const hasPassword = password.length > 0
    if (!isSignup) return hasEmail && hasPassword
    return (
      hasEmail &&
      password.length >= 12 &&
      confirmPassword.length > 0 &&
      confirmPassword === password
    )
  }, [email, password, confirmPassword, isSignup])

  const submitAsync = async (e) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setError('Please enter your email.')
      return
    }
    if (!password) {
      setError('Please enter your password.')
      return
    }

    if (isSignup) {
      if (password.length < 12) {
        setError('Use a stronger password (at least 12 characters).')
        return
      }
      if (confirmPassword !== password) {
        setError('Passwords do not match.')
        return
      }

      try {
        const data = await authSignup({
          email: normalizedEmail,
          password,
          name: fullName.trim() || undefined,
          account_type: 'external',
        })
        setPassword('')
        setConfirmPassword('')
        setMode('login')
        setInfo(data?.message || 'Request submitted. An administrator will approve your access.')
        setToasts((t) => [
          {
            id: `${Date.now()}-signup`,
            type: 'success',
            title: 'Request submitted',
            message: 'You can sign in after an administrator approves your account.',
            ttlMs: 5500,
          },
          ...t,
        ])
        return
      } catch (err) {
        const status = err?.response?.status
        if (status === 409) {
          setError('An account with this email already exists. Please sign in instead.')
          return
        }
        setError(formatApiErrorMessage(err, 'Unable to create account. Please try again.'))
        return
      }
    }

    try {
      const data = await authLogin({ email: normalizedEmail, password })
      setToasts((t) => [
        { id: `${Date.now()}-login`, type: 'success', title: 'Signed in', message: 'Welcome back.', ttlMs: 2500 },
        ...t,
      ])
      onAuthenticated?.(data?.user || { email: normalizedEmail })
    } catch (err) {
      const status = err?.response?.status
      if (status === 404) {
        setError('No account found for this email. Please create one first.')
        return
      }
      if (status === 401) {
        setError('Incorrect password. Please try again.')
        return
      }
      setError(formatApiErrorMessage(err, 'Unable to sign in. Please try again.'))
    }
  }

  const showGate = step === 'gate'

  return (
    <div className="min-h-screen overflow-x-hidden auth-shell-bg text-gray-900">
      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))}
      />
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
        <div className="hidden lg:flex relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_10%_10%,rgba(0,151,80,0.18),transparent_55%),radial-gradient(900px_500px_at_90%_30%,rgba(16,185,129,0.18),transparent_55%),linear-gradient(180deg,#ffffff,rgba(248,250,252,1))]" />
          <div className="relative z-10 flex flex-col justify-between p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                Enterprise Life
              </div>
              <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900">
                Customer Pulse
              </h1>
              <p className="mt-2 text-lg text-gray-600">your Customer Feedback Assistant</p>
            </div>
            <p className="text-xs text-gray-500">
              Secure access for internal teams and approved partners.
            </p>
          </div>
        </div>

        <div className="flex items-start sm:items-center justify-center px-4 py-8 sm:p-6 lg:p-10">
          <div className="w-full max-w-md">
            <div className="card p-6 lg:p-7 bg-white/90 dark:bg-gray-950/70">
              {showGate ? (
                <AuthGate
                  onExternal={() => {
                    setStep('external')
                    setError(null)
                    setInfo(null)
                  }}
                />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('gate')
                      setError(null)
                      setInfo(null)
                    }}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-900"
                  >
                    ← Back
                  </button>

                  <div className="mt-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {isSignup ? 'Request external access' : 'Sign in'}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {isSignup
                        ? 'For partners and contractors without an Enterprise email'
                        : 'Use the email and password from your approval'}
                    </p>
                  </div>

                  {error && (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                      {error}
                    </div>
                  )}
                  {info && (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                      {info}
                    </div>
                  )}

                  <form onSubmit={submitAsync} className="mt-6 space-y-4">
                    {isSignup && (
                      <div>
                        <FieldLabel>Full name (optional)</FieldLabel>
                        <TextInput
                          type="text"
                          placeholder="Your name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          autoComplete="name"
                        />
                      </div>
                    )}
                    <div>
                      <FieldLabel>Email</FieldLabel>
                      <TextInput
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete={isSignup ? 'email' : 'username'}
                      />
                    </div>
                    <div>
                      <FieldLabel>Password</FieldLabel>
                      <PasswordInput
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={isSignup ? 'Create a password' : 'Enter your password'}
                        autoComplete={isSignup ? 'new-password' : 'current-password'}
                      />
                      {isSignup && <p className="mt-2 text-[11px] text-gray-500">{strengthHint}</p>}
                    </div>
                    {isSignup && (
                      <div>
                        <FieldLabel>Confirm password</FieldLabel>
                        <PasswordInput
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter your password"
                          autoComplete="new-password"
                        />
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="inline-flex w-full min-h-[44px] items-center justify-center rounded-lg bg-[#009750] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#007a42] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#009750] focus:ring-offset-2"
                    >
                      {isSignup ? 'Submit request' : 'Continue'}
                    </button>
                  </form>

                  <div className="mt-5 text-center text-sm text-gray-600">
                    {isSignup ? (
                      <>
                        Already approved?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setMode('login')
                            setError(null)
                            setInfo(null)
                          }}
                          className="font-semibold text-[#009750] hover:text-[#007a42]"
                        >
                          Sign in
                        </button>
                      </>
                    ) : (
                      <>
                        Need access?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setMode('signup')
                            setError(null)
                            setInfo(null)
                          }}
                          className="font-semibold text-[#009750] hover:text-[#007a42]"
                        >
                          Request access
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
