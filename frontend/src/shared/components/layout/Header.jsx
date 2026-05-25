import { FiMenu, FiMoon, FiRefreshCw, FiSun } from 'react-icons/fi'
import UserProfileMenu from './UserProfileMenu'

function Header({
  title = 'Feedback Dashboard',
  onToggleSidebar,
  theme,
  onToggleTheme,
  showRefresh,
  onRefresh,
  refreshDisabled,
  user,
  onSignOut,
}) {
  return (
    <header className="bg-white/95 border-b border-emerald-100/50 px-4 sm:px-6 py-3 sm:py-4 shadow-sm dark:bg-gray-950/90 dark:border-gray-800">
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 items-center md:w-auto">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#009750] md:hidden dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <span className="sr-only">Toggle sidebar</span>
            <FiMenu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <h1 className="min-w-0 flex-1 text-center text-lg sm:text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 truncate md:text-left">
          {title}
        </h1>

        <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
          {showRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshDisabled}
              aria-label="Refresh dashboard"
              title="Refresh"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#009750] focus:ring-offset-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              <FiRefreshCw className="h-5 w-5" aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#009750] focus:ring-offset-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <FiSun className="h-5 w-5" /> : <FiMoon className="h-5 w-5" />}
          </button>
          <UserProfileMenu user={user} onSignOut={onSignOut} />
        </div>
      </div>
    </header>
  )
}

export default Header
