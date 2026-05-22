import SettingsSubpageShell from '../../shared/components/settings/SettingsSubpageShell'

const APP_VERSION = '1.0.0'

export default function SettingsHelpPage() {
  return (
    <SettingsSubpageShell
      title="Help & about"
      description="Product information and support."
    >
      <div className="card p-6 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Product
          </p>
          <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">Customer Pulse</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Version {APP_VERSION}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Support
          </p>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            For access, channels, or data issues, contact your platform administrator or IT team.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Privacy
          </p>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            Feedback content may include personal data. Handle exports and shared reports according to your
            organization&apos;s data policy.
          </p>
        </div>
      </div>
    </SettingsSubpageShell>
  )
}
