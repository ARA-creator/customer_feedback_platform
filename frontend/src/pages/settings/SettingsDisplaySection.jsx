import { FiMoon, FiSun, FiMonitor } from 'react-icons/fi'
import { useDisplayPreferences } from '../../shared/context/DisplayPreferencesContext'
import {
  INSIGHTS_RANGE_OPTIONS,
  OVERVIEW_PERIOD_OPTIONS,
  TEXT_SIZE_OPTIONS,
} from '../../shared/lib/displayPreferences'

function SettingToggle({ id, label, description, checked, onChange, disabled }) {
  return (
    <li className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-800">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer">
          {label}
        </label>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300"
      />
    </li>
  )
}

const THEME_OPTIONS = [
  { id: 'light', label: 'Light', Icon: FiSun },
  { id: 'dark', label: 'Dark', Icon: FiMoon },
  { id: 'system', label: 'System', Icon: FiMonitor },
]

export default function SettingsDisplaySection({ isAdminUser = false }) {
  const { prefs, resolvedTheme, updatePreferences, setThemeMode } = useDisplayPreferences()

  return (
    <div className="card p-6">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Changes apply immediately on this device.
      </p>

      <div className="mt-5">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Color theme</p>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Same control as the moon icon in the top bar. Currently{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {resolvedTheme === 'dark' ? 'dark' : 'light'}
          </span>
          {prefs.themeMode === 'system' ? ' (following system)' : ''}.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Color theme">
          {THEME_OPTIONS.map(({ id, label, Icon }) => {
            const active = prefs.themeMode === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setThemeMode(id)}
                className={`inline-flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-[#009750] bg-[#009750]/10 text-[#007a42] dark:text-emerald-200'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <ul className="mt-5 space-y-4">
        <SettingToggle
          id="cfp-reduced-motion"
          label="Reduce motion"
          description="Minimize animations and transitions for accessibility."
          checked={prefs.reducedMotion}
          onChange={(v) => updatePreferences({ reducedMotion: v })}
        />
        <SettingToggle
          id="cfp-compact-density"
          label="Compact layout"
          description="Tighter spacing on cards and page content."
          checked={prefs.compactDensity}
          onChange={(v) => updatePreferences({ compactDensity: v })}
        />
        <SettingToggle
          id="cfp-notification-sounds"
          label="Notification sounds"
          description="Play a short sound when live toast alerts appear."
          checked={prefs.notificationSounds}
          onChange={(v) => updatePreferences({ notificationSounds: v })}
        />
        {isAdminUser && (
          <SettingToggle
            id="cfp-dashboard-auto-refresh"
            label="Auto-refresh dashboard"
            description="Refresh overview and insights every 30 seconds while you are signed in."
            checked={prefs.dashboardAutoRefresh}
            onChange={(v) => updatePreferences({ dashboardAutoRefresh: v })}
          />
        )}
      </ul>

      <div className="mt-5">
        <label htmlFor="cfp-text-size" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Text size
        </label>
        <select
          id="cfp-text-size"
          value={prefs.textSize}
          onChange={(e) => updatePreferences({ textSize: e.target.value })}
          className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009750]/30 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
        >
          {TEXT_SIZE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5">
        <label
          htmlFor="cfp-default-overview-period"
          className="text-sm font-semibold text-gray-900 dark:text-gray-100"
        >
          Default overview period
        </label>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Starting time range when you open the overview dashboard.
        </p>
        <select
          id="cfp-default-overview-period"
          value={prefs.defaultOverviewPeriod}
          onChange={(e) => updatePreferences({ defaultOverviewPeriod: e.target.value })}
          className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009750]/30 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
        >
          {OVERVIEW_PERIOD_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5">
        <label
          htmlFor="cfp-default-insights-range"
          className="text-sm font-semibold text-gray-900 dark:text-gray-100"
        >
          Default insights range
        </label>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Starting date range when you open the insights dashboard.
        </p>
        <select
          id="cfp-default-insights-range"
          value={prefs.defaultInsightsRange}
          onChange={(e) => updatePreferences({ defaultInsightsRange: Number(e.target.value) })}
          className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009750]/30 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
        >
          {INSIGHTS_RANGE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
