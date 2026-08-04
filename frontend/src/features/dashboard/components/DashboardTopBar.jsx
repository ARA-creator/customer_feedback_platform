export default function DashboardTopBar({
  mode,
  loading,
  analyticsDelayPassed,
  lastUpdated,
  error,
  formatRelativeTime,
  isAdminUser,
  dashboardAutoRefresh,
}) {
  if (mode === 'overview' || mode === 'insights') {
    return null
  }

  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        {loading || !analyticsDelayPassed ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-8 w-64 bg-gray-100 rounded-lg" />
            <div className="h-4 w-72 bg-gray-100 rounded-lg" />
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
              {mode === 'inbox' ? 'Feedback Inbox' : 'Feedback Dashboard'}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              {mode === 'inbox'
                ? 'Search, triage, and act on individual customer feedback across all channels'
                : 'Monitor and analyze customer feedback across all channels'}
            </p>
            {lastUpdated && !error && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Updated {formatRelativeTime(lastUpdated.toISOString())}
                {isAdminUser && dashboardAutoRefresh && (
                  <> · auto-refresh every 30s · live analytics when new feedback arrives</>
                )}
                {isAdminUser && !dashboardAutoRefresh && (
                  <> · auto-refresh off (admins can enable it in the toolbar)</>
                )}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
