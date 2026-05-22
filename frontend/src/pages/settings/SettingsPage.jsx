import { Link } from 'react-router-dom'
import { FiChevronRight } from 'react-icons/fi'

const SETTINGS_SECTIONS = [
  { to: '/settings/account', title: 'Account', subtitle: 'Email, role, and sign-in' },
  { to: '/settings/display', title: 'Display', subtitle: 'Theme, layout, and defaults' },
  { to: '/settings/notifications', title: 'Notifications', subtitle: 'In-app alerts and quiet hours' },
  { to: '/settings/inbox', title: 'Inbox', subtitle: 'Default filters and archive' },
  { to: '/settings/security', title: 'Security', subtitle: 'Password and sign-in' },
  { to: '/settings/help', title: 'Help & about', subtitle: 'Version and support' },
]

export default function SettingsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Settings</h1>

      <div className="card overflow-hidden p-0 divide-y divide-gray-200 dark:divide-gray-800">
        {SETTINGS_SECTIONS.map((section) => (
          <Link
            key={section.to}
            to={section.to}
            className="flex min-h-[56px] items-center justify-between gap-4 px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-900/50"
          >
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{section.title}</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{section.subtitle}</p>
            </div>
            <FiChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  )
}
