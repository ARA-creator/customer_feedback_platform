import { Link } from 'react-router-dom'
import { FiChevronRight } from 'react-icons/fi'
import { buildQuickActions } from '../settingsConfig'

export default function SettingsQuickActions({ auth }) {
  const actions = buildQuickActions(auth)
  if (actions.length === 0) return null

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Quick actions</h2>
      <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
        {actions.map((action) => (
          <li key={action.to + action.title}>
            <Link
              to={action.to}
              className="group flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:text-[#007a42] dark:hover:text-emerald-300"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-[#007a42] dark:group-hover:text-emerald-200">
                  {action.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{action.description}</p>
              </div>
              <FiChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
