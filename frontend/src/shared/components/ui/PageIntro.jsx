/**
 * One-line purpose + optional hint for keyboard shortcuts (reduces cognitive load).
 */
export default function PageIntro({ title, subtitle, hint }) {
  return (
    <div className="min-w-0 max-w-full">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight text-gray-900 dark:text-gray-100 break-words">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-1.5 sm:mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400 max-w-2xl break-words">
          {subtitle}
        </p>
      ) : null}
      {hint ? (
        <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-500 max-w-2xl break-words">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
