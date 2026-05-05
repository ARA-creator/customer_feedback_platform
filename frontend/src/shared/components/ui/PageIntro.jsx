/**
 * One-line purpose + optional hint for keyboard shortcuts (reduces cognitive load).
 */
export default function PageIntro({ title, subtitle, hint }) {
  return (
    <div className="min-w-0">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{title}</h1>
      {subtitle ? (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">{subtitle}</p>
      ) : null}
      {hint ? (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-500 max-w-2xl">{hint}</p>
      ) : null}
    </div>
  )
}
