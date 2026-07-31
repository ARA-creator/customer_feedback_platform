import ReportsWorkspace from '../../features/reports/components/ReportsWorkspace'

export default function ReportsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Reports</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Build sentiment briefings and export feedback.
        </p>
      </div>
      <ReportsWorkspace />
    </div>
  )
}
