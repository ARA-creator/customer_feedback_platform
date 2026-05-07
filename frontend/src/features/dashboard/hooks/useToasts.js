import { useCallback, useMemo, useState } from 'react'

function toastTypeFromVariant(variant) {
  const v = String(variant || 'info').toLowerCase()
  if (v === 'success') return 'success'
  if (v === 'error') return 'error'
  // treat warning as info in the global toast style
  return 'info'
}

/**
 * Simple toast state container.
 *
 * - `pushToast(title, message, variant)` appends a toast with TTL.
 * - `toastStackProps` is shaped for the shared `ToastStack`.
 */
export function useToasts({ defaultTtlMs = 5000 } = {}) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const pushToast = useCallback(
    (title, message, variant = 'info') => {
      setToasts((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          title,
          message,
          variant,
          ttlMs: defaultTtlMs,
        },
      ])
    },
    [defaultTtlMs],
  )

  const toastStackProps = useMemo(
    () => ({
      toasts: toasts.map((t) => ({
        id: t.id,
        type: toastTypeFromVariant(t.variant),
        title: t.title,
        message: t.message,
        ttlMs: t.ttlMs,
      })),
      onDismiss: dismiss,
    }),
    [toasts, dismiss],
  )

  return { toasts, setToasts, pushToast, dismissToast: dismiss, toastStackProps }
}

