import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FiBarChart2, FiDownload } from 'react-icons/fi'
import Dashboard from '../../features/dashboard/components/Dashboard'
import ReportsWorkspace from '../../features/reports/components/ReportsWorkspace'

const TABS = [
  { id: 'insights', label: 'Insights', icon: FiBarChart2 },
  { id: 'exports', label: 'Briefings & exports', icon: FiDownload },
]

export default function ReportsPage({
  userRole,
  onNavigateToInbox,
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = String(searchParams.get('tab') || 'insights').toLowerCase()
  const activeTab = tabParam === 'exports' ? 'exports' : 'insights'

  const setTab = (id) => {
    const next = new URLSearchParams(searchParams)
    if (id === 'insights') next.delete('tab')
    else next.set('tab', id)
    setSearchParams(next, { replace: true })
  }

  const subtitle = useMemo(() => {
    if (activeTab === 'insights') {
      return 'Themes, channels, peak times, and product trends.'
    }
    return 'Build sentiment briefings and export feedback.'
  }, [activeTab])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Reports</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
        <div
          className="mt-4 inline-flex rounded-xl border border-gray-200/90 bg-gray-50/80 p-1 dark:border-gray-800 dark:bg-gray-950/60"
          role="tablist"
          aria-label="Reports sections"
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[#009750] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </button>
            )
          })}
        </div>
      </header>

      {activeTab === 'exports' ? (
        <ReportsWorkspace />
      ) : (
        <Dashboard
          mode="insights"
          isAdminUser={false}
          userRole={userRole}
          onNavigateToInbox={onNavigateToInbox}
        />
      )}
    </div>
  )
}
