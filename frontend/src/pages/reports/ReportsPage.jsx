import { useState } from 'react'
import { FiCalendar, FiDownload } from 'react-icons/fi'
import CustomReport from '../../features/reports/components/CustomReport'
import ScheduleReport from '../../features/reports/components/ScheduleReport'

export default function ReportsPage() {
  const [tab, setTab] = useState('custom')

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Export feedback data or save scheduled report definitions.
        </p>
        <div
          className="mt-4 inline-flex rounded-full border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-950"
          role="tablist"
          aria-label="Report types"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'custom'}
            onClick={() => setTab('custom')}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
              tab === 'custom'
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900'
            }`}
          >
            <FiDownload className="h-3.5 w-3.5" />
            Custom export
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'schedules'}
            onClick={() => setTab('schedules')}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
              tab === 'schedules'
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900'
            }`}
          >
            <FiCalendar className="h-3.5 w-3.5" />
            Schedules
          </button>
        </div>
      </div>

      {tab === 'custom' ? (
        <CustomReport embedded />
      ) : (
        <ScheduleReport embedded />
      )}
    </div>
  )
}
