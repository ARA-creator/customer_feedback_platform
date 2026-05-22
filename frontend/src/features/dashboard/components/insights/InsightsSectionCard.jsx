export default function InsightsSectionCard({ title, subtitle, right, children, className = '' }) {
  return (
    <div className={`card p-4 sm:p-6 bg-white/90 dark:bg-gray-950/75 ${className}`}>
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 max-w-prose">{subtitle}</p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}
