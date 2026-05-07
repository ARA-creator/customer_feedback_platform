import { FiCalendar, FiClock } from 'react-icons/fi'

const FILTERS = [
  { id: 'today', label: 'Today', Icon: FiClock },
  { id: 'week', label: 'This Week', Icon: FiCalendar },
  { id: 'month', label: 'This Month', Icon: FiCalendar },
  { id: 'all', label: 'All Time', Icon: FiCalendar },
]

export default function OverviewTimeFilterRow({ value, onChange }) {
  return (
    <div className="mb-4 rounded-2xl border border-emerald-100/60 bg-white/35 px-3 py-2.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-gray-950/25 sm:px-4 sm:py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
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
    </div>
  )
}

