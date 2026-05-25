import { userIsAdminUI } from '../../app/routes'
import AccountInformationCard from './components/AccountInformationCard'
import SettingsQuickActions from './components/SettingsQuickActions'
import SettingsIntegrationsSummary from './components/SettingsIntegrationsSummary'
import SettingsRecentActivity from './components/SettingsRecentActivity'

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
  const showIntegrations = canViewIntegrations(auth)
  const showActivity = canViewActivityLog(auth)

  return (
    <div className="space-y-5">
      <AccountInformationCard auth={auth} />

      <div className="grid gap-5 lg:grid-cols-2">
        <SettingsQuickActions auth={auth} />
        {userIsAdminUI(auth) ? (
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Admin access</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Use the Admin section in the sidebar for users, channels, integrations, and platform health.
            </p>
          </div>
        ) : (
          <div className="hidden lg:block" aria-hidden />
        )}
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
