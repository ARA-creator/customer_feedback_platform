import { userIsAdminUI } from '../../app/routes'
import SettingsQuickActions from './components/SettingsQuickActions'
import SettingsIntegrationsSummary from './components/SettingsIntegrationsSummary'
import SettingsRecentActivity from './components/SettingsRecentActivity'

function formatRole(role) {
  const r = String(role || '').trim()
  if (!r) return 'User'
  if (r === 'super_admin') return 'Super admin'
  return r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function canViewActivityLog(auth) {
  const perms = Array.isArray(auth?.permissions) ? auth.permissions : []
  return (
    perms.includes('admin.manage_users') ||
    perms.includes('admin.manage_roles') ||
    perms.includes('admin.view_audit_logs')
  )
}

function canViewIntegrations(auth) {
  const perms = Array.isArray(auth?.permissions) ? auth.permissions : []
  const isSuperAdmin = String(auth?.role || '').toLowerCase() === 'super_admin'
  return perms.includes('admin.manage_integrations') || isSuperAdmin
}

export default function SettingsAccountPage({ auth }) {
  const isEnterprise = auth?.auth_provider === 'azure_ad'
  const email = auth?.email || '—'
  const role = formatRole(auth?.role)
  const showIntegrations = canViewIntegrations(auth)
  const showActivity = canViewActivityLog(auth)

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Account overview</h2>
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
                : 'Email and password. Change your password under the Security tab.'}
            </p>
          </div>
          {userIsAdminUI(auth) && (
            <p className="text-xs text-gray-500 dark:text-gray-400 rounded-lg bg-gray-50 dark:bg-gray-900/50 px-3 py-2">
              Admin accounts use the Admin section in the sidebar for users, channels, and platform health.
            </p>
          )}
        </div>

        <SettingsQuickActions auth={auth} />
      </div>

      {(showIntegrations || showActivity) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {showIntegrations && <SettingsIntegrationsSummary />}
          {showActivity && <SettingsRecentActivity auth={auth} canViewActivity={showActivity} />}
        </div>
      )}
    </div>
  )
}
