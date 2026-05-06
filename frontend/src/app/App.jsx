import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import Sidebar from '../shared/components/layout/Sidebar'
import Header from '../shared/components/layout/Header'
import Channels from '../features/channels/components/Channels'
import AuthShell from '../features/auth/components/AuthShell'
import { authLogout, authMe } from '../features/auth/services/auth.api'
import AdminUsers from '../features/admin/components/AdminUsers'
import AdminRoles from '../features/admin/components/AdminRoles'
import AdminIntegrations from '../features/admin/components/AdminIntegrations'
import AdminOverview from '../features/admin/components/AdminOverview'
import AdminReleaseImpact from '../features/admin/components/AdminReleaseImpact'
import AdminDbConnection from '../features/admin/components/AdminDbConnection'
import Notifications from '../features/notifications/components/Notifications'
import Customer360 from '../features/customers/components/Customer360'
import { AuthLoadingScreen, ErrorBoundary } from '../shared/components/ui'
import DashboardOverviewPage from '../pages/dashboard/Overview'
import DashboardInsightsPage from '../pages/dashboard/Insights'
import InboxPage from '../pages/inbox/Inbox'

function App() {
  const [auth, setAuth] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [currentView, setCurrentView] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [theme, setTheme] = useState(() => localStorage.getItem('cfp_theme') || 'light')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await authMe()
        if (cancelled) return
        if (data?.authenticated) setAuth(data.user)
        else setAuth(null)
      } catch {
        if (!cancelled) setAuth(null)
      } finally {
        if (!cancelled) setAuthLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('cfp_theme', theme)
  }, [theme])

  const isAuthed = useMemo(() => !!auth?.email, [auth])
  const permissions = useMemo(() => (Array.isArray(auth?.permissions) ? auth.permissions : []), [auth])
  const isAdminUI = useMemo(
    () =>
      permissions.includes('admin.manage_users') ||
      permissions.includes('admin.manage_roles') ||
      permissions.includes('admin.manage_integrations') ||
      String(auth?.role || '').toLowerCase() === 'super_admin',
    [permissions, auth?.role]
  )
  const canManageIntegrations = useMemo(() => permissions.includes('admin.manage_integrations'), [permissions])
  const isSuperAdmin = useMemo(
    () => String(auth?.role || '').toLowerCase() === 'super_admin',
    [auth?.role],
  )
  /** Webhooks, connection URLs, and channel status — integration admins only (not user/role-only admins). */
  const canAccessWebhooks = useMemo(
    () => canManageIntegrations || isSuperAdmin,
    [canManageIntegrations, isSuperAdmin],
  )

  const signOut = useCallback(() => {
    ;(async () => {
      try {
        await authLogout()
      } catch {
        // ignore
      } finally {
        setAuth(null)
        setCurrentView('overview')
      }
    })()
  }, [])

  const navigateToInboxWithPreset = useCallback((preset) => {
    try {
      sessionStorage.setItem('cfp_inbox_peak_preset', JSON.stringify(preset || {}))
    } catch {
      // ignore
    }
    setCurrentView('inbox')
  }, [setCurrentView])

  useEffect(() => {
    if (!currentView.startsWith('admin_')) return
    if (!isAdminUI) setCurrentView('overview')
  }, [currentView, isAdminUI])

  useEffect(() => {
    if (currentView !== 'channels') return
    if (!canAccessWebhooks) setCurrentView(isAdminUI ? 'admin_overview' : 'overview')
  }, [currentView, canAccessWebhooks, isAdminUI])

  /** Admins / super_admin do not use the agent Overview, Insights, or Inbox surfaces. */
  useLayoutEffect(() => {
    if (!isAdminUI) return
    if (currentView === 'overview' || currentView === 'insights' || currentView === 'inbox') {
      setCurrentView('admin_overview')
    }
  }, [isAdminUI, currentView])

  if (authLoading) {
    return <AuthLoadingScreen />
  }

  if (!isAuthed) {
    return (
      <AuthShell
        onAuthenticated={(payload) => {
          setAuth(payload)
        }}
      />
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen overflow-hidden app-shell-bg text-gray-900 relative dark:text-gray-100">
        {/* Mobile overlay to close sidebar when clicking outside */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          sidebarOpen={sidebarOpen}
          onSignOut={signOut}
          theme={theme}
          permissions={permissions}
          userRole={auth?.role}
          isAdminUser={isAdminUI}
          canAccessWebhooks={canAccessWebhooks}
          user={
            auth
              ? { id: auth.id, email: auth.email, role: auth.role }
              : null
          }
        />
        <div className="flex-1 flex flex-col overflow-hidden relative z-10">
          <Header
            currentView={currentView}
            onToggleSidebar={() => setSidebarOpen((open) => !open)}
            theme={theme}
            onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          />
          <main className="flex-1 overflow-y-auto">
            {!isAdminUI && currentView === 'overview' && (
              <DashboardOverviewPage
                userRole={auth?.role}
                onNavigateToInsights={() => setCurrentView('insights')}
                onNavigateToInbox={navigateToInboxWithPreset}
              />
            )}
            {!isAdminUI && currentView === 'insights' && (
              <DashboardInsightsPage
                userRole={auth?.role}
                onNavigateBack={() => setCurrentView('overview')}
                onNavigateToInbox={navigateToInboxWithPreset}
              />
            )}
            {!isAdminUI && currentView === 'inbox' && <InboxPage onNavigate={setCurrentView} />}
            {currentView === 'notifications' && (
              <Notifications isAdminUI={isAdminUI} onNavigate={setCurrentView} />
            )}
            {!isAdminUI && currentView === 'customer' && <Customer360 onNavigate={setCurrentView} />}
            {currentView === 'channels' && <Channels />}
            {currentView === 'admin_overview' && (
              <AdminOverview auth={auth} onNavigate={(view) => setCurrentView(view)} />
            )}
            {currentView === 'admin_users' && <AdminUsers />}
            {currentView === 'admin_roles' && <AdminRoles />}
            {currentView === 'admin_integrations' && <AdminIntegrations />}
            {currentView === 'admin_release_impact' && <AdminReleaseImpact />}
            {currentView === 'admin_db' && <AdminDbConnection />}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default App
