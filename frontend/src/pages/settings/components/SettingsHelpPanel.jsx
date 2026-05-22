import { Link } from 'react-router-dom'
import { FiChevronRight, FiExternalLink } from 'react-icons/fi'
import { HELP_RESOURCES } from '../settingsConfig'

export default function SettingsHelpPanel() {
  return (
    <div className="card p-4">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Need help?</p>
      <ul className="mt-3 space-y-2">
        {HELP_RESOURCES.map((item) => {
          const inner = (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{item.description}</p>
              </div>
              {item.external ? (
                <FiExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
              ) : (
                <FiChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
              )}
            </>
          )

          if (item.to) {
            return (
              <li key={item.title}>
                <Link
                  to={item.to}
                  className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-900/50"
                >
                  {inner}
                </Link>
              </li>
            )
          }

          return (
            <li key={item.title}>
              <span className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-gray-500 dark:text-gray-400">
                {inner}
              </span>
            </li>
          )
        })}
      </ul>
      <Link
        to="/settings/help"
        className="mt-3 inline-block text-xs font-medium text-[#009750] hover:text-[#007a42] dark:text-emerald-400"
      >
        Full navigation guide
      </Link>
    </div>
  )
}
