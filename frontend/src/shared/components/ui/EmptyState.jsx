import { FiInbox } from 'react-icons/fi'

/**
 * Shared empty state: clear title, explanation, optional actions.
 */
export default function EmptyState({
  icon: Icon = FiInbox,
  title = 'Nothing here yet',
  description,
  primaryAction,
  secondaryAction,
  className = '',
}) {
  return (
    <div
      className={`card p-8 text-center ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#009750]/10 text-[#009750] dark:bg-emerald-500/10 dark:text-emerald-300">
        <Icon className="h-7 w-7" aria-hidden />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md mx-auto text-sm text-gray-500 dark:text-gray-400">{description}</p>
      ) : null}
      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {primaryAction ? (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#009750] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#007a42] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
            >
              {primaryAction.label}
            </button>
          ) : null}
          {secondaryAction ? (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750]/40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}
