import { useState } from 'react'
import { FiCheckCircle } from 'react-icons/fi'
import AuthVerifyInline from '../../features/auth/components/AuthVerifyInline'
import { ToastStack } from '../../shared/components/ui'

function emailFromQuery() {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('email') || ''
}

export default function VerifyEmailPage({ onDone }) {
  const initialEmail = emailFromQuery()
  const [email, setEmail] = useState(initialEmail)
  const [done, setDone] = useState(false)
  const [toasts, setToasts] = useState([])

  if (done) {
    return (
      <div className="min-h-screen auth-shell-bg flex items-center justify-center p-4 sm:p-6">
        <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
        <div className="w-full max-w-md card p-6 bg-white/95 text-center shadow-lg">
          <FiCheckCircle className="mx-auto h-10 w-10 text-[#009750]" aria-hidden />
          <h1 className="mt-4 text-xl font-semibold text-gray-900">Email verified</h1>
          <p className="mt-2 text-sm text-gray-600">You can continue to the app.</p>
          <button
            type="button"
            onClick={() => onDone?.()}
            className="mt-6 inline-flex min-h-[44px] items-center rounded-xl bg-[#009750] px-6 py-2 text-sm font-semibold text-white hover:bg-[#007a42]"
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen auth-shell-bg flex items-center justify-center p-4 sm:p-6">
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
      <div className="w-full max-w-md card p-6 lg:p-8 bg-white/95 shadow-lg">
        <AuthVerifyInline
          email={email}
          onEmailChange={setEmail}
          showEmailField={!initialEmail}
          codeSent={Boolean(initialEmail)}
          onBack={() => onDone?.()}
          onSuccess={() => {
            setToasts((t) => [
              {
                id: `${Date.now()}-verify`,
                type: 'success',
                title: 'Verified',
                message: 'Email confirmed successfully.',
                ttlMs: 3500,
              },
              ...t,
            ])
            setDone(true)
          }}
        />
      </div>
    </div>
  )
}
