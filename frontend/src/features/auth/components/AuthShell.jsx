import { useMemo, useState } from 'react'
import { FiEye, FiEyeOff, FiShield, FiBookOpen } from 'react-icons/fi'
import { authLogin, authSignup } from '../services/auth.api'

const ROLE_OPTIONS = [
  { value: 'management', label: 'Management' },
  { value: 'agent', label: 'Agent' },
  { value: 'cx & support', label: 'CX / Support' },
  { value: 'operations', label: 'Operations' },
  { value: 'super_admin', label: 'Admin' },
]

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
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const isSignup = mode === 'signup'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState('agent')
  const [error, setError] = useState(null)

  const formatApiErrorMessage = (err, fallback) => {
    const apiErr = err?.response?.data?.error
    if (typeof apiErr === 'string' && apiErr.trim()) return apiErr
    if (apiErr && typeof apiErr === 'object') {
      const code = typeof apiErr.code === 'string' ? apiErr.code : ''
      const msg = typeof apiErr.message === 'string' ? apiErr.message : ''
      const joined = [code, msg].filter(Boolean).join(': ')
      if (joined) return joined
      try {
        return JSON.stringify(apiErr)
      } catch {
        // ignore
      }
    }
    const msg = err?.message
    if (typeof msg === 'string' && msg.trim()) return msg
    return fallback
  }

  const strengthHint = useMemo(() => {
    const len = password.length
    if (!isSignup) return null
    if (!password) return 'Use at least 12 characters…'
    if (len < 8) return 'Too short — aim for 12+ characters.'
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
      confirmPassword === password &&
      !!role
    )
  }, [email, password, confirmPassword, role, isSignup])

  const submit = (e) => {
    // handled async below
    e.preventDefault()
  }

  const submitAsync = async (e) => {
    e.preventDefault()
    setError(null)
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
      if (!role) {
        setError('Please choose a role/department.')
        return
      }
      if (password.length < 12) {
        setError('Use a stronger password (at least 12 characters).')
        return
      }
      if (confirmPassword !== password) {
        setError('Passwords do not match.')
        return
      }

      try {
        const data = await authSignup({ email: normalizedEmail, password, role })
        onAuthenticated?.(data?.user || { email: normalizedEmail, role })
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

  return (
    <div className="min-h-screen app-shell-bg text-gray-900">
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
        {/* Left hero */}
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
              <p className="mt-2 text-lg text-gray-600">
                your Customer Feedback Assistant
              </p>
            </div>

            <div className="mt-10 space-y-4 max-w-lg">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-gray-200 shadow-sm">
                  <FiBookOpen className="h-4 w-4 text-gray-700" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">One inbox for every channel</p>
                  <p className="text-xs text-gray-500 mt-0.5">See email, web mentions, and forms in one place—without missing anything.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-gray-200 shadow-sm">
                  <FiShield className="h-4 w-4 text-gray-700" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Faster triage &amp; resolution</p>
                  <p className="text-xs text-gray-500 mt-0.5">Filter by priority, sentiment, and category to act quickly on urgent cases.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-gray-200 shadow-sm">
                  <FiShield className="h-4 w-4 text-gray-700" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Sentiment &amp; consolidation</p>
                  <p className="text-xs text-gray-500 mt-0.5">Monitor customer sentiment across channels and spot trends early.</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Secure access for internal teams. Your data stays within Enterprise Life systems.
            </p>
          </div>
        </div>

        {/* Right card */}
        <div className="flex items-center justify-center p-6 lg:p-10">
          <div className="w-full max-w-md">
            <div className="card p-6 lg:p-7">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-[#009750]/10 border border-emerald-200 flex items-center justify-center">
                  <span className="text-sm font-bold text-emerald-800">EL</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Enterprise Life</p>
                  <p className="text-xs text-gray-500">Customer Feedback Platform</p>
                </div>
              </div>

              <div className="mt-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {isSignup ? 'Create your account' : 'Welcome back'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {isSignup ? 'Sign up to get started' : 'Sign in to continue'}
                </p>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {error}
                </div>
              )}

              <form onSubmit={submitAsync} className="mt-6 space-y-4">
                <div>
                  <FieldLabel>Email</FieldLabel>
                  <TextInput
                    type="email"
                    placeholder="name@enterprise-life.com"
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
                  {isSignup && (
                    <p className="mt-2 text-[11px] text-gray-500">{strengthHint}</p>
                  )}
                </div>

                {isSignup && (
                  <>
                    <div>
                      <FieldLabel>Confirm password</FieldLabel>
                      <PasswordInput
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                      />
                    </div>

                    <div>
                      <FieldLabel>Role / department</FieldLabel>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/40 focus:border-[#009750]/40"
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex w-full min-h-[44px] items-center justify-center rounded-lg bg-[#009750] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#007a42] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#009750] focus:ring-offset-2"
                >
                  {isSignup ? 'Create account' : 'Continue'}
                </button>
              </form>

              <div className="mt-5 text-center text-sm text-gray-600">
                {isSignup ? (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login')
                        setError(null)
                      }}
                      className="font-semibold text-[#009750] hover:text-[#007a42]"
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    Need an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signup')
                        setError(null)
                      }}
                      className="font-semibold text-[#009750] hover:text-[#007a42]"
                    >
                      Create one
                    </button>
                  </>
                )}
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-gray-500">
              By continuing, you agree to internal Enterprise Life usage policies.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

