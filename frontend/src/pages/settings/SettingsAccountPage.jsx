import SettingsSubpageShell from '../../shared/components/settings/SettingsSubpageShell'

function formatRole(role) {
  const r = String(role || '').trim()
  if (!r) return 'User'
  if (r === 'super_admin') return 'Super admin'
  return r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function SettingsAccountPage({ auth }) {
  const isEnterprise = auth?.auth_provider === 'azure_ad'
  const email = auth?.email || '—'
  const role = formatRole(auth?.role)

  return (
    <SettingsSubpageShell
      title="Account"
      description="Your signed-in profile on Customer Pulse."
    >
      <div className="card p-6 space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Email
          </p>
          <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100 break-all">{email}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Role
          </p>
          <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{role}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Sign-in
          </p>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            {isEnterprise
              ? 'Enterprise (Microsoft Azure AD). Password is managed by your organization.'
              : 'Email and password. Change your password under Security.'}
          </p>
        </div>
      </div>
    </SettingsSubpageShell>
  )
}
