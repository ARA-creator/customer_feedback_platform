import { FiMenu, FiMoon, FiSun } from 'react-icons/fi'

function Header({ currentView, onToggleSidebar, theme, onToggleTheme }) {
  const label =
    currentView === 'inbox'
      ? 'Inbox'
      : currentView === 'notifications'
        ? 'Notifications'
      : currentView === 'insights'
        ? 'Insights'
      : currentView === 'customer'
        ? 'Customer 360'
        : currentView === 'channels'
          ? 'Channels'
          : currentView === 'schedule_report'
            ? 'Schedule report'
            : currentView === 'custom_report'
              ? 'Custom report'
              : currentView === 'admin_overview'
                ? 'Admin overview'
                : currentView === 'admin_users'
                  ? 'Admin users'
                  : currentView === 'admin_roles'
                    ? 'Roles & permissions'
                    : currentView === 'admin_integrations'
                      ? 'Integrations health'
                      : currentView === 'admin_release_impact'
                        ? 'Release impact'
                        : currentView === 'admin_db'
                          ? 'Database connection'
                          : currentView === 'admin_audit'
                            ? 'Audit logs'
                            : 'Overview'
  return (
    <header className="bg-white/90 backdrop-blur-sm border-b border-emerald-100/50 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm dark:bg-gray-950 dark:border-gray-800">
      <div className="flex items-center">
        {/* Hamburger toggle - mobile only */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="mr-3 inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#009750] md:hidden dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          <span className="sr-only">Toggle sidebar</span>
          <FiMenu className="h-5 w-5" aria-hidden="true" />
        </button>
        <nav className="text-sm text-gray-600 dark:text-gray-300" aria-label="Breadcrumb">
          <span className="text-gray-500 dark:text-gray-400">Customer Pulse</span>
          <span className="mx-2 text-gray-400" aria-hidden>
            /
          </span>
          <span className="text-gray-900 font-medium dark:text-gray-100">
            {label}
          </span>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleTheme}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#009750] focus:ring-offset-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <FiSun className="h-5 w-5" /> : <FiMoon className="h-5 w-5" />}
        </button>
      </div>
    </header>
  )
}

export default Header
