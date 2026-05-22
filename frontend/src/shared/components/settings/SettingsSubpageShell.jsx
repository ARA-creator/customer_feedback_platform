import { Link } from 'react-router-dom'
import { FiArrowLeft } from 'react-icons/fi'

export default function SettingsSubpageShell({ title, description, children }) {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <Link
        to="/settings/account"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <FiArrowLeft className="h-4 w-4" aria-hidden />
        Settings
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
        ) : null}
      </div>

      {children}
    </div>
  )
}
