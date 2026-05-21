import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pathForView } from '../../../app/routes'
import {
  FiActivity,
  FiBell,
  FiChevronLeft,
  FiChevronRight,
  FiHome,
  FiInbox,
  FiKey,
  FiLayout,
  FiLink2,
  FiLogOut,
  FiServer,
  FiSettings,
  FiShield,
  FiUsers,
  FiDownload,
} from 'react-icons/fi'
import { connectNotificationsStream, getUnreadCount } from '../../../features/notifications/services/notifications.api'

const RAIL_KEY = 'cfp_sidebar_rail_collapsed'

/**
 * Ref layout uses Enterprise Life #009750 for active items (index.css .sidebar-link-active).
 * Reference mockups often use orange for “active” — we keep brand green; tokens stay semantic.
 */
function getInitials(email) {
  const local = String(email || '').split('@')[0] || 'U'
  return local.slice(0, 2).toUpperCase()
}

function displayNameFromEmail(email) {
  if (!email) return 'User'
  const local = String(email).split('@')[0] || 'User'
  return local.length > 24 ? `${local.slice(0, 21)}…` : local
}

function NavButton({
  active,
  collapsed,
  icon: Icon,
  label,
  onClick,
  testId,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      data-testid={testId}
      className={`sidebar-link w-full ${
        active ? 'sidebar-link-active' : 'sidebar-link-inactive'
      } ${collapsed ? 'md:justify-center md:px-2 md:space-x-0' : ''} focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span
        className={`truncate ${
          collapsed ? 'md:sr-only' : ''
        }`}
      >
        {label}
      </span>
    </button>
  )
}

function Sidebar({
  currentView,
  sidebarOpen = true,
  onSignOut,
  theme: _theme,
  permissions = [],
  userRole = '',
  /** Kept for API parity with App; visibility is derived from permissions + role below. */
  isAdminUser: _isAdminUserFromApp,
  canAccessWebhooks: canAccessWebhooksProp,
  /** { email, role, id? } from /auth/me — optional. */
  user: userProp = null,
}) {
  const navigate = useNavigate()
  const go = useCallback((view) => navigate(pathForView(view)), [navigate])

  const perms = Array.isArray(permissions) ? permissions : []
  const isSuperAdmin = String(userRole || '').toLowerCase() === 'super_admin'
  /** Same rule as App.jsx — never trust a lone boolean over RBAC. */
  const hasAdminAccess =
    perms.includes('admin.manage_users') ||
    perms.includes('admin.manage_roles') ||
    perms.includes('admin.manage_integrations') ||
    isSuperAdmin
  /** Parent may force-hide (e.g. during transitions); never force-show without permissions. */
  const isAdminUI = _isAdminUserFromApp === false ? false : hasAdminAccess
  const canAccessWebhooks = typeof canAccessWebhooksProp === 'boolean' ? canAccessWebhooksProp : false
  const canManageUsers = perms.includes('admin.manage_users')
  const canManageRoles = perms.includes('admin.manage_roles')
  const canManageIntegrations = perms.includes('admin.manage_integrations')
  const canViewReports =
    perms.includes('reports.view_org') ||
    perms.includes('reports.view_team') ||
    perms.includes('reports.export') ||
    canManageUsers ||
    isSuperAdmin
  const canApproveReplies = perms.includes('feedback.approve') || canManageUsers
  const canViewActivity =
    canManageUsers || perms.includes('admin.view_audit_logs') || canManageRoles

  const [railCollapsed, setRailCollapsed] = useState(false)

  const [notificationsUnread, setNotificationsUnread] = useState(0)

  useEffect(() => {
    try {
      setRailCollapsed(localStorage.getItem(RAIL_KEY) === '1')
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await getUnreadCount()
        if (!mounted) return
        const n = Number(res?.unread ?? 0)
        setNotificationsUnread(Number.isFinite(n) && n >= 0 ? n : 0)
      } catch {
        // ignore
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const applyUnreadFromServer = useCallback((n) => {
    const v = Number(n)
    setNotificationsUnread(Number.isFinite(v) && v >= 0 ? v : 0)
  }, [])

  useEffect(() => {
    const refreshUnread = () => {
      getUnreadCount()
        .then((res) => applyUnreadFromServer(res?.unread))
        .catch(() => {})
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshUnread()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('cfp-notifications-unread', refreshUnread)

    const cleanup = connectNotificationsStream((evt) => {
      if (evt?.type === 'notification.unread_count' && Number.isFinite(Number(evt.unread))) {
        applyUnreadFromServer(evt.unread)
        return
      }
      if (evt?.type === 'notification.created' && Number.isFinite(Number(evt.unread))) {
        applyUnreadFromServer(evt.unread)
      }
    })
    return () => {
      cleanup()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('cfp-notifications-unread', refreshUnread)
    }
  }, [applyUnreadFromServer])

  const setCollapsed = useCallback((v) => {
    setRailCollapsed(v)
    try {
      localStorage.setItem(RAIL_KEY, v ? '1' : '0')
    } catch {
      // ignore
    }
  }, [])

  const userEmail = userProp?.email || ''
  const userLabel = useMemo(() => displayNameFromEmail(userEmail), [userEmail])
  const initials = useMemo(() => getInitials(userEmail), [userEmail])

  const c = railCollapsed
  /** Agent-only: Overview + Inbox. Admin / super_admin cannot use those surfaces (see App.jsx). */
  const showAgentDashboardNav = !isAdminUI

  return (
    <aside
      className={`
        sidebar-shell flex flex-col flex-shrink-0 z-30
        fixed inset-y-0 left-0 h-[100dvh] max-h-[100dvh] transform transition-all duration-200 ease-out
        w-64 max-w-[85vw] overflow-x-hidden
        ${c ? 'md:w-[4.5rem] md:max-w-[4.5rem]' : 'md:w-64 md:max-w-none'}
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:static md:translate-x-0
        md:my-2 md:ml-2 md:rounded-2xl md:max-h-[calc(100vh-1rem)]
      `}
    >
      {/* —— Top: brand, collapse (desktop), search —— */}
      <div
        className={`flex flex-col border-b border-gray-200/90 dark:border-gray-800/90 shrink-0 ${
          c ? 'md:px-2 md:pt-3 md:pb-2' : 'px-4 pt-4 pb-3'
        }`}
      >
        <div
          className={`flex items-center gap-2 ${
            c ? 'md:flex-col md:items-stretch' : ''
          }`}
        >
          <div
            className="flex min-w-0 flex-1 items-center gap-2"
            title="Customer Pulse"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#009750]/10 text-[#009750] dark:bg-[#009750]/20 dark:text-[#4ade80]"
              aria-hidden
            >
              <span className="text-lg font-bold leading-none">C</span>
            </div>
            <div className={`min-w-0 ${c ? 'md:hidden' : ''}`}>
              <h1
                className="truncate text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                Customer Pulse
              </h1>
              <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">Enterprise Life</p>
            </div>
          </div>
          <div
            className={`flex items-center gap-1 shrink-0 ${
              c ? 'md:w-full md:justify-center' : 'ml-auto'
            }`}
          >
            <button
              type="button"
              onClick={() => setCollapsed(!railCollapsed)}
              className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-300 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750] focus-visible:ring-offset-2"
              title={c ? 'Expand sidebar' : 'Collapse to icon rail'}
              aria-label={c ? 'Expand sidebar' : 'Collapse sidebar to icon rail'}
              aria-pressed={c}
            >
              {c ? <FiChevronRight className="h-4 w-4" aria-hidden /> : <FiChevronLeft className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>
      </div>

      <nav
        className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain ${
          c ? 'md:px-1.5 md:py-3' : 'px-3 py-3'
        } space-y-1`}
        aria-label="Main navigation"
      >
        {showAgentDashboardNav && (
          <>
            <p
              className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500 ${
                c ? 'md:sr-only' : ''
              }`}
            >
              Dashboards
            </p>
            <NavButton
              active={currentView === 'overview'}
              collapsed={c}
              icon={FiHome}
              label="Overview"
              onClick={() => go('overview')}
              testId="nav-overview"
            />
            <NavButton
              active={currentView === 'inbox'}
              collapsed={c}
              icon={FiInbox}
              label="Inbox"
              onClick={() => go('inbox')}
              testId="nav-inbox"
            />
          </>
        )}

        {isAdminUI && (
          <>
            <p
              className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500 ${
                c ? 'md:sr-only' : ''
              }`}
            >
              Admin
            </p>
            <NavButton
              active={currentView === 'admin_overview'}
              collapsed={c}
              icon={FiLayout}
              label="Admin overview"
              onClick={() => go('admin_overview')}
            />
            {canAccessWebhooks && (
              <NavButton
                active={currentView === 'channels'}
                collapsed={c}
                icon={FiLink2}
                label="Webhooks & channels"
                onClick={() => go('channels')}
              />
            )}
            {(canManageUsers || isSuperAdmin) && (
              <NavButton
                active={currentView === 'admin_users'}
                collapsed={c}
                icon={FiUsers}
                label="Users"
                onClick={() => go('admin_users')}
                testId="nav-admin-users"
              />
            )}
            {canManageRoles && (
              <NavButton
                active={currentView === 'admin_roles'}
                collapsed={c}
                icon={FiKey}
                label="Roles & permissions"
                onClick={() => go('admin_roles')}
              />
            )}
            {canManageIntegrations && (
              <NavButton
                active={currentView === 'admin_integrations'}
                collapsed={c}
                icon={FiActivity}
                label="Integrations health"
                onClick={() => go('admin_integrations')}
              />
            )}
            {canManageIntegrations && (
              <NavButton
                active={currentView === 'admin_release_impact'}
                collapsed={c}
                icon={FiActivity}
                label="Release impact"
                onClick={() => go('admin_release_impact')}
              />
            )}
            {canManageIntegrations && (
              <NavButton
                active={currentView === 'admin_db'}
                collapsed={c}
                icon={FiServer}
                label="Database connection"
                onClick={() => go('admin_db')}
              />
            )}
            {canManageIntegrations && (
              <NavButton
                active={currentView === 'admin_enterprise_auth'}
                collapsed={c}
                icon={FiKey}
                label="Enterprise SSO"
                onClick={() => go('admin_enterprise_auth')}
                testId="nav-admin-enterprise-auth"
              />
            )}
            {canApproveReplies && (
              <NavButton
                active={currentView === 'admin_reply_approvals'}
                collapsed={c}
                icon={FiShield}
                label="Reply approvals"
                onClick={() => go('admin_reply_approvals')}
              />
            )}
            {canViewActivity && (
              <NavButton
                active={currentView === 'admin_activity'}
                collapsed={c}
                icon={FiActivity}
                label="User activity"
                onClick={() => go('admin_activity')}
              />
            )}
          </>
        )}

        <div
          className={`my-2 border-t border-gray-200 dark:border-gray-800 ${c ? 'md:mx-0' : ''}`}
          aria-hidden
        />
        <p
          className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500 ${
            c ? 'md:sr-only' : ''
          }`}
        >
          Account
        </p>
        {canViewReports && (
          <NavButton
            active={currentView === 'reports'}
            collapsed={c}
            icon={FiDownload}
            label="Reports"
            onClick={() => go('reports')}
            testId="nav-reports"
          />
        )}
        <NavButton
          active={currentView === 'settings' || currentView === 'settings_security'}
          collapsed={c}
          icon={FiSettings}
          label="Settings"
          onClick={() => go('settings')}
          testId="nav-settings"
        />
        <button
          type="button"
          onClick={() => go('notifications')}
          title="Notifications"
          aria-label="Notifications"
          aria-current={currentView === 'notifications' ? 'page' : undefined}
          data-testid="nav-notifications"
          className={`sidebar-link w-full ${
            currentView === 'notifications' ? 'sidebar-link-active' : 'sidebar-link-inactive'
          } ${c ? 'md:justify-center md:px-2 md:space-x-0 relative' : ''} focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950`}
        >
          <FiBell className="h-5 w-5 shrink-0" aria-hidden />
          <span className={c ? 'md:sr-only' : ''}>Notifications</span>
          <span
            className={`ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              currentView === 'notifications'
                ? 'bg-white/15 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
            } ${c ? 'md:absolute md:right-1.5 md:top-1.5 md:ml-0 md:px-1.5' : ''}`}
            aria-label={`${notificationsUnread} unread notifications`}
            title={`${notificationsUnread} unread`}
          >
            {notificationsUnread}
          </span>
        </button>
        <button
          type="button"
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      </nav>

      {/* —— User strip + visible sign out —— */}
      <div
        className={`mt-auto border-t border-gray-200/90 p-2 dark:border-gray-800/90 ${
          c ? 'md:px-1.5' : ''
        }`}
      >
        <div
          className={`flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/90 p-2 dark:border-gray-800 dark:bg-gray-900/50 ${
            c ? 'md:flex-col md:gap-1.5' : ''
          }`}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#009750] to-[#0d9f5c] text-xs font-semibold text-white"
            title={userEmail || 'Signed in user'}
            aria-hidden
          >
            {initials}
          </div>
          <div className={`min-w-0 flex-1 ${c ? 'md:hidden' : ''}`}>
            <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{userLabel}</p>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{userEmail || '—'}</p>
          </div>
        </div>
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            data-testid="nav-sign-out"
            title="Sign out"
            aria-label="Sign out"
            className={`mt-2 flex w-full min-h-[44px] items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30 ${
              c ? 'md:justify-center md:px-2 md:py-2' : ''
            } focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950`}
          >
            <FiLogOut className="h-5 w-5 shrink-0" aria-hidden />
            <span className={c ? 'md:sr-only' : ''}>Sign out</span>
          </button>
        )}
        {!c && (
          <p className="mt-2 text-center text-[10px] text-gray-500 dark:text-gray-500">Customer feedback platform</p>
        )}
      </div>
    </aside>
  )
}

export default Sidebar
