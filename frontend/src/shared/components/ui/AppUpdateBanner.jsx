import { FiRefreshCw } from 'react-icons/fi'
import { useAppUpdateCheck } from '../../hooks/useAppUpdateCheck'

/**
 * Brief notice while a newer production deploy is being applied (auto-reload).
 */
export default function AppUpdateBanner() {
  const { updateAvailable } = useAppUpdateCheck()
  if (!updateAvailable) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] flex justify-center p-3 pointer-events-none sm:p-4"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-[#009750]/30 bg-white px-4 py-3 shadow-lg shadow-black/10 dark:border-emerald-700/40 dark:bg-gray-950 dark:shadow-black/40">
        <FiRefreshCw className="h-4 w-4 shrink-0 animate-spin text-[#009750]" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Updating…</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            A new version is live. Reloading automatically.
          </p>
        </div>
      </div>
    </div>
  )
}
