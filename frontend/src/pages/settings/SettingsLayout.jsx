import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import SettingsTipsPanel from './components/SettingsTipsPanel'
import SettingsHelpPanel from './components/SettingsHelpPanel'
import SettingsHowItWorks from './components/SettingsHowItWorks'
import { SETTINGS_TABS } from './settingsConfig'

export default function SettingsLayout({ auth }) {
  const location = useLocation()

  if (location.pathname === '/settings' || location.pathname === '/settings/') {
    return <Navigate to="/settings/account" replace />
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage your account, preferences, and workspace settings.
          </p>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-5">
          <nav
            className="flex gap-0 overflow-x-auto border-b border-gray-200 dark:border-gray-800 [-webkit-overflow-scrolling:touch]"
            aria-label="Settings sections"
          >
            {SETTINGS_TABS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `inline-flex shrink-0 items-center gap-2 border-b-2 -mb-px px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-[#009750] text-[#009750] dark:text-emerald-400'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>

          <Outlet context={{ auth }} />
        </div>

        <aside className="mt-6 space-y-4 lg:mt-0">
          <SettingsTipsPanel auth={auth} />
          <SettingsHelpPanel />
          <SettingsHowItWorks />
        </aside>
      </div>
    </div>
  )
}
