import { FiArrowLeft, FiMenu, FiMoon, FiSun } from 'react-icons/fi'
import UserProfileMenu from './UserProfileMenu'

function Header({
  title = 'Feedback Dashboard',
  onToggleSidebar,
  theme,
  onToggleTheme,
  user,
  onSignOut,
  hideAgentLinks = false,
  onBack = null,
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
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#009750] focus:ring-offset-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <FiSun className="h-5 w-5" /> : <FiMoon className="h-5 w-5" />}
          </button>
          <UserProfileMenu user={user} onSignOut={onSignOut} hideAgentLinks={hideAgentLinks} />
        </div>
      </div>

      {typeof onBack === 'function' ? (
        <div className="mt-2 md:mt-2.5">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#009750]/40 bg-[#009750]/15 text-[#007a42] hover:bg-[#009750]/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750]/40 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
            aria-label="Back to inbox"
            title="Back to inbox"
          >
            <FiArrowLeft className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </header>
  )
}

export default Header
