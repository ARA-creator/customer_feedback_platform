import { FiRefreshCw, FiDownload } from 'react-icons/fi'

export default function DashboardTopBar({
  mode,
  loading,
  analyticsDelayPassed,
  lastUpdated,
  error,
  formatRelativeTime,
  isAdminUser,
  dashboardAutoRefresh,
  dashboardAutoRefreshKey,
  onToggleAutoRefresh,
  onRefresh,
  onExportOverviewCsv,
}) {
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

      {(mode === 'overview' || mode === 'insights') && !loading && (
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center justify-center min-h-[44px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-[#009750]/30"
          >
            <FiRefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </button>

          {isAdminUser && (
            <label className="inline-flex items-center gap-2 min-h-[44px] cursor-pointer select-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 focus-within:ring-2 focus-within:ring-[#009750]/30">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-[#009750] focus:ring-[#009750]"
                checked={dashboardAutoRefresh}
                onChange={(e) => onToggleAutoRefresh?.(e.target.checked)}
              />
              <span>Auto-refresh (30s + live)</span>
            </label>
          )}

          {mode === 'overview' && (
            <button
              type="button"
              onClick={onExportOverviewCsv}
              className="inline-flex items-center justify-center min-h-[44px] rounded-xl bg-[#009750] px-3.5 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#007a42] transition-colors focus:outline-none focus:ring-2 focus:ring-[#009750]/30"
            >
              <FiDownload className="w-4 h-4 mr-1.5" />
              Export CSV
            </button>
          )}
        </div>
      )}
    </div>
  )
}

