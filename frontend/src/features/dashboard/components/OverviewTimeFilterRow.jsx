import { FiCalendar, FiClock, FiDownload } from 'react-icons/fi'

const FILTERS = [
  { id: 'today', label: 'Today', Icon: FiClock },
  { id: 'week', label: 'This Week', Icon: FiCalendar },
  { id: 'last_week', label: 'Last Week', Icon: FiCalendar },
  { id: 'month', label: 'This Month', Icon: FiCalendar },
  { id: 'all', label: 'All Time', Icon: FiCalendar },
]

export default function OverviewTimeFilterRow({
  value,
  onChange,
  onExportCsv,
  exportDisabled = false,
  isAdminUser = false,
  dashboardAutoRefresh = false,
  onToggleAutoRefresh,
}) {
  return (
    <div className="mb-4 rounded-2xl border border-emerald-100/60 bg-white/80 px-3 py-2.5 shadow-sm dark:border-white/10 dark:bg-gray-950/70 sm:px-4 sm:py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 shrink-0">
            Filter by:
          </span>
          <div className="-mx-1 flex w-full flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1 [-webkit-overflow-scrolling:touch]">
            {FILTERS.map(({ id, label, Icon }) => {
              const active = value === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChange?.(id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[40px] ${
                    active
                      ? 'border-[#009750] bg-[#009750] text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
                  }`}
                  aria-pressed={active}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2">
          {isAdminUser && (
            <label className="inline-flex items-center gap-2 min-h-[40px] cursor-pointer select-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-[#009750] focus:ring-[#009750]"
                checked={dashboardAutoRefresh}
                onChange={(e) => onToggleAutoRefresh?.(e.target.checked)}
              />
              <span className="whitespace-nowrap">Auto-refresh</span>
            </label>
          )}
          <button
            type="button"
            onClick={onExportCsv}
            disabled={exportDisabled}
            className="inline-flex items-center justify-center min-h-[40px] rounded-xl bg-[#009750] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#007a42] disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-[#009750]/30"
          >
            <FiDownload className="h-4 w-4 mr-1.5 shrink-0" aria-hidden />
            Export CSV
          </button>
        </div>
      </div>
    </div>
  )
}
