import { useEffect, useState } from 'react'
import { authConfig } from '../services/auth.api'

function enterpriseLoginUrl() {
  const base = import.meta.env.DEV && !String(import.meta.env.VITE_BACKEND_ORIGIN || '').trim()
    ? '/api'
    : import.meta.env.VITE_BACKEND_ORIGIN
      ? `${String(import.meta.env.VITE_BACKEND_ORIGIN).replace(/\/+$/, '')}/api`
      : '/api'
  return `${base}/auth/enterprise/login`
}

export default function AuthGate({ onEnterprise, onExternal }) {
  const [cfg, setCfg] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    authConfig()
      .then(setCfg)
      .catch(() => setCfg({ enterprise_sso_enabled: false, external_signup_enabled: true }))
  }, [])

  const ssoReady = cfg?.enterprise_sso_enabled

  const handleEnterprise = () => {
    if (!ssoReady) {
      setError('Enterprise sign-in is not configured yet. Contact your IT administrator.')
      return
    }
    setError(null)
    window.location.href = enterpriseLoginUrl()
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#009750]/10 border border-emerald-200">
        <span className="text-lg font-bold text-emerald-800">EL</span>
      </div>
      <h2 className="mt-6 text-xl font-semibold text-gray-900">Welcome to Customer Pulse</h2>
      <p className="mt-2 text-sm text-gray-500 max-w-sm">
        Choose how you sign in. Enterprise staff use their work email; partners and contractors request access separately.
      </p>

      {error && (
        <div className="mt-4 w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="mt-8 w-full space-y-3">
        <button
          type="button"
          onClick={handleEnterprise}
          disabled={cfg && !ssoReady}
          className="inline-flex w-full min-h-[48px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#009750]/40"
        >
          I have an Enterprise email
        </button>
        <button
          type="button"
          onClick={onExternal}
          disabled={cfg && cfg.external_signup_enabled === false}
          className="inline-flex w-full min-h-[48px] items-center justify-center rounded-lg bg-[#1e293b] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0f172a] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#009750]/40"
        >
          I do not have an Enterprise email
        </button>
      </div>

      {cfg && !ssoReady && (
        <p className="mt-4 text-xs text-amber-700">
          Enterprise SSO requires Azure AD setup. External access is still available below.
        </p>
      )}
    </div>
  )
}
