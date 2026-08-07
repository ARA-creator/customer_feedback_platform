import { FiRefreshCw } from 'react-icons/fi'
import { useAppUpdateCheck } from '../../hooks/useAppUpdateCheck'

/**
 * Fixed banner when a newer production deploy is available.
 * User chooses Reload so we don't interrupt mid-edit.
 */
export default function AppUpdateBanner() {
  const { updateAvailable, reload, dismiss } = useAppUpdateCheck()
  if (!updateAvailable) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] flex justify-center p-3 pointer-events-none sm:p-4"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex w-full max-w-lg flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#009750]/30 bg-white px-4 py-3 shadow-lg shadow-black/10 dark:border-emerald-700/40 dark:bg-gray-950 dark:shadow-black/40">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">New version available</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            A fresh deploy is live. Reload to get the latest updates.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex min-h-[36px] items-center rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Later
          </button>
          <button
            type="button"
            onClick={reload}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#009750] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#007a42] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750]/40"
          >
            <FiRefreshCw className="h-3.5 w-3.5" aria-hidden />
            Reload
          </button>
        </div>
      </div>
    </div>
  )
}
