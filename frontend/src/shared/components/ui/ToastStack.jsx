import { useEffect } from 'react'
import { FiCheckCircle, FiInfo, FiXCircle } from 'react-icons/fi'

const ICONS = {
  success: FiCheckCircle,
  error: FiXCircle,
  info: FiInfo,
}

export default function ToastStack({ toasts, onDismiss }) {
  useEffect(() => {
    if (!Array.isArray(toasts) || toasts.length === 0) return
    const timers = toasts
      .filter((t) => t?.ttlMs != null)
      .map((t) => setTimeout(() => onDismiss?.(t.id), Number(t.ttlMs)))
    return () => timers.forEach((x) => clearTimeout(x))
  }, [toasts, onDismiss])

  if (!Array.isArray(toasts) || toasts.length === 0) return null

  return (
    <div className="fixed right-4 top-4 z-[60] flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.map((t) => {
        const type = t?.type || 'info'
        const Icon = ICONS[type] || FiInfo
        const base =
          type === 'success'
            ? 'border-emerald-200/70 bg-emerald-50/80 text-emerald-950 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100'
            : type === 'error'
              ? 'border-rose-200/70 bg-rose-50/80 text-rose-950 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100'
              : 'border-gray-200/70 bg-white/75 text-gray-900 dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-100'

        return (
          <div
            key={t.id}
            className={`rounded-2xl border px-3.5 py-3 shadow-sm backdrop-blur-md ${base}`}
          >
            <div className="flex items-start gap-2.5">
              <Icon className="mt-0.5 h-4 w-4 opacity-90" aria-hidden />
              <div className="min-w-0 flex-1">
                {t.title && <p className="text-sm font-semibold">{t.title}</p>}
                {t.message && <p className="mt-0.5 text-sm opacity-90">{t.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => onDismiss?.(t.id)}
                className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-[#009750]/20 dark:hover:bg-white/10"
                aria-label="Dismiss"
                title="Dismiss"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

