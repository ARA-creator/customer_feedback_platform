/**
 * Skeleton placeholders — reduces layout shift and clarifies loading vs empty.
 */

function SkeletonLine({ className = '' }) {
  return (
    <div
      className={`skeleton-shimmer rounded-md bg-gray-200/90 dark:bg-gray-700/80 ${className}`.trim()}
      aria-hidden
    />
  )
}

/** Auth gate full-screen placeholder */
export function AuthLoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center app-shell-bg text-gray-700 dark:text-gray-200 px-6">
      <div className="w-full max-w-sm space-y-4" role="status" aria-label="Loading application">
        <div className="flex items-center gap-3">
          <SkeletonLine className="h-12 w-12 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-2 w-full min-w-0">
            <SkeletonLine className="h-5 w-[75%]" />
            <SkeletonLine className="h-3 w-1/2" />
          </div>
        </div>
        <SkeletonLine className="h-2 w-full rounded-full" />
        <p className="text-sm text-center text-gray-500 dark:text-gray-400">Loading Customer Pulse…</p>
      </div>
    </div>
  )
}

/** Inbox / list-style feed */
export function InboxListSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading feedback">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/50"
        >
          <div className="flex flex-wrap gap-2">
            <SkeletonLine className="h-6 w-20" />
            <SkeletonLine className="h-6 w-24" />
            <SkeletonLine className="h-6 w-32" />
          </div>
          <SkeletonLine className="mt-4 h-4 w-full" />
          <SkeletonLine className="mt-2 h-4 w-[85%]" />
          <SkeletonLine className="mt-2 h-3 w-40" />
        </div>
      ))}
    </div>
  )
}

export function Customer360Skeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading customer profile">
      <div className="card p-5">
        <SkeletonLine className="h-4 w-40" />
        <div className="mt-4 space-y-2">
          <SkeletonLine className="h-3 w-full" />
          <SkeletonLine className="h-3 w-[83%]" />
        </div>
      </div>
      <div className="card p-5">
        <SkeletonLine className="h-4 w-32" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <SkeletonLine className="h-16 w-full rounded-xl" />
          <SkeletonLine className="h-16 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export function NotificationListSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading notifications">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card p-4">
          <div className="flex gap-3">
            <SkeletonLine className="h-4 w-4 rounded shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <SkeletonLine className="h-3 w-2/3" />
              <SkeletonLine className="h-3 w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
