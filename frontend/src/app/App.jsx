import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Sidebar from '../shared/components/layout/Sidebar'
import Header from '../shared/components/layout/Header'
import Channels from '../features/channels/components/Channels'
import AuthShell from '../features/auth/components/AuthShell'
import { authLogout, authMe } from '../features/auth/services/auth.api'
import { connectNotificationsStream } from '../features/notifications/services/notifications.api'
import AdminUsers from '../features/admin/components/AdminUsers'
import AdminRoles from '../features/admin/components/AdminRoles'
import AdminIntegrations from '../features/admin/components/AdminIntegrations'
import AdminOverview from '../features/admin/components/AdminOverview'
import AdminReleaseImpact from '../features/admin/components/AdminReleaseImpact'
import AdminDbConnection from '../features/admin/components/AdminDbConnection'
import Notifications from '../features/notifications/components/Notifications'
import Customer360 from '../features/customers/components/Customer360'
import { AuthLoadingScreen } from '../shared/components/ui/LoadingSkeleton'
import ErrorBoundary from '../shared/components/ui/ErrorBoundary'
import DashboardOverviewPage from '../pages/dashboard/Overview'
import DashboardInsightsPage from '../pages/dashboard/Insights'
import InboxPage from '../pages/inbox/Inbox'
import SettingsPage from '../pages/settings/SettingsPage'

function playNotificationBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = 880
    g.gain.value = 0.0001
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    const now = ctx.currentTime
    g.gain.setTargetAtTime(0.05, now, 0.01)
    g.gain.setTargetAtTime(0.0001, now + 0.12, 0.02)
    o.stop(now + 0.18)
    o.onended = () => {
      try {
        ctx.close()
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

function App() {
  const [auth, setAuth] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [currentView, setCurrentView] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Mobile-first: start with drawer closed on small screens.
    if (typeof window === 'undefined') return true
    return window.matchMedia?.('(min-width: 768px)')?.matches ?? true
  })
  const [theme, setTheme] = useState(() => localStorage.getItem('cfp_theme') || 'light')
  const [liveToasts, setLiveToasts] = useState([])
  const dashboardRefreshRef = useRef(null)

  const registerDashboardRefresh = useCallback((fn) => {
    dashboardRefreshRef.current = typeof fn === 'function' ? fn : null
  }, [])

  const handleDashboardRefresh = useCallback(() => {
    dashboardRefreshRef.current?.()
  }, [])

  const showDashboardRefresh = currentView === 'overview' || currentView === 'insights'

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

  useEffect(() => {
    const cleanup = connectNotificationsStream((evt) => {
      if (evt?.type !== 'notification.created' || !evt?.notification) return
      const n = evt.notification
      const id = `${Date.now()}-${Math.random()}`
      setLiveToasts((prev) => [
        { id, title: n.title || 'New notification', body: n.body || '', href: n.href || 'notifications' },
        ...prev,
      ].slice(0, 3))
      playNotificationBeep()
      window.setTimeout(() => {
        setLiveToasts((prev) => prev.filter((t) => t.id !== id))
      }, 6500)
    })
    return cleanup
  }, [])

  const navigateToInboxWithPreset = useCallback((preset) => {
    try {
      sessionStorage.setItem('cfp_inbox_peak_preset', JSON.stringify(preset || {}))
    } catch {
      // ignore
    }
    setCurrentView('inbox')
  }, [setCurrentView])

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo(0, 0)
    const main = document.querySelector('main')
    if (main) main.scrollTop = 0
  }, [currentView])

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
    if (typeof window !== 'undefined') {
      const path = window.location.pathname || ''
      if (path.startsWith('/verify-email') || path.startsWith('/reset-password')) {
        window.location.replace('/')
        return <AuthLoadingScreen />
      }
    }
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
      <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden overflow-x-hidden app-shell-bg text-gray-900 relative dark:text-gray-100">
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
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative z-10">
          <Header
            currentView={currentView}
            onToggleSidebar={() => setSidebarOpen((open) => !open)}
            theme={theme}
            onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            showRefresh={showDashboardRefresh}
            onRefresh={handleDashboardRefresh}
          />
          <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
            {!isAdminUI && currentView === 'overview' && (
              <DashboardOverviewPage
                userRole={auth?.role}
                onNavigateToInsights={() => setCurrentView('insights')}
                onNavigateToInbox={navigateToInboxWithPreset}
                registerRefresh={registerDashboardRefresh}
              />
            )}
            {!isAdminUI && currentView === 'insights' && (
              <DashboardInsightsPage
                userRole={auth?.role}
                onNavigateBack={() => setCurrentView('overview')}
                onNavigateToInbox={navigateToInboxWithPreset}
                registerRefresh={registerDashboardRefresh}
              />
            )}
            {!isAdminUI && currentView === 'inbox' && <InboxPage onNavigate={setCurrentView} />}
            {currentView === 'settings' && <SettingsPage />}
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

        {liveToasts.length > 0 && (
          <div className="fixed bottom-4 right-4 z-50 space-y-2 w-[min(92vw,22rem)]">
            {liveToasts.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl border border-emerald-200/60 bg-white/70 px-4 py-3 shadow-[0_18px_46px_rgba(16,185,129,0.16),0_10px_30px_rgba(2,6,23,0.10)] backdrop-blur-md dark:border-emerald-400/15 dark:bg-gray-950/35"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-2.5 w-2.5 rounded-full bg-[#009750]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.title}</p>
                    {t.body ? (
                      <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                        {t.body}
                      </p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLiveToasts((prev) => prev.filter((x) => x.id !== t.id))
                          setCurrentView('notifications')
                        }}
                        className="inline-flex min-h-[36px] items-center rounded-xl bg-[#009750] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#007a42] focus:outline-none focus:ring-2 focus:ring-[#009750]/30"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => setLiveToasts((prev) => prev.filter((x) => x.id !== t.id))}
                        className="inline-flex min-h-[36px] items-center rounded-xl border border-gray-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#009750]/20 dark:border-white/10 dark:bg-gray-950/30 dark:text-gray-100 dark:hover:bg-gray-950/55"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default App
