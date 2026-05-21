import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
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
import AdminEnterpriseAuth from '../features/admin/components/AdminEnterpriseAuth'
import Notifications from '../features/notifications/components/Notifications'
import Customer360 from '../features/customers/components/Customer360'
import { AuthLoadingScreen } from '../shared/components/ui/LoadingSkeleton'
import ErrorBoundary from '../shared/components/ui/ErrorBoundary'
import DashboardOverviewPage from '../pages/dashboard/Overview'
import DashboardInsightsPage from '../pages/dashboard/Insights'
import InboxPage from '../pages/inbox/Inbox'
import SettingsPage from '../pages/settings/SettingsPage'
import {
  defaultPathForUser,
  isAdminPath,
  isDashboardAgentPath,
  userIsAdminUI,
  viewFromPathname,
} from './routes'
import { useAppNavigate } from './useAppNavigate'

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

function AppChrome({
  auth,
  isAdminUI,
  permissions,
  sidebarOpen,
  setSidebarOpen,
  theme,
  setTheme,
  signOut,
  showDashboardRefresh,
  onDashboardRefresh,
}) {
  const location = useLocation()
  const currentView = viewFromPathname(location.pathname)

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo(0, 0)
    const main = document.querySelector('main')
    if (main) main.scrollTop = 0
  }, [location.pathname])

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden overflow-x-hidden app-shell-bg text-gray-900 relative dark:text-gray-100">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        currentView={currentView}
        sidebarOpen={sidebarOpen}
        onSignOut={signOut}
        theme={theme}
        permissions={permissions}
        userRole={auth?.role}
        isAdminUser={isAdminUI}
        canAccessWebhooks={permissions.includes('admin.manage_integrations') || String(auth?.role || '').toLowerCase() === 'super_admin'}
        user={auth ? { id: auth.id, email: auth.email, role: auth.role } : null}
      />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative z-10">
        <Header
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          showRefresh={showDashboardRefresh}
          onRefresh={onDashboardRefresh}
        />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function AuthenticatedApp({ auth, setAuth }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia?.('(min-width: 768px)')?.matches ?? true
  })
  const [theme, setTheme] = useState(() => localStorage.getItem('cfp_theme') || 'light')
  const [liveToasts, setLiveToasts] = useState([])
  const dashboardRefreshRef = useRef(null)
  const navigateToView = useAppNavigate()

  const permissions = useMemo(() => (Array.isArray(auth?.permissions) ? auth.permissions : []), [auth])
  const isAdminUI = useMemo(() => userIsAdminUI(auth), [auth])
  const canManageIntegrations = useMemo(() => permissions.includes('admin.manage_integrations'), [permissions])
  const isSuperAdmin = useMemo(() => String(auth?.role || '').toLowerCase() === 'super_admin', [auth?.role])
  const canAccessWebhooks = useMemo(
    () => canManageIntegrations || isSuperAdmin,
    [canManageIntegrations, isSuperAdmin],
  )

  const currentView = viewFromPathname(location.pathname)
  const showDashboardRefresh = currentView === 'overview' || currentView === 'insights'

  const registerDashboardRefresh = useCallback((fn) => {
    dashboardRefreshRef.current = typeof fn === 'function' ? fn : null
  }, [])

  const handleDashboardRefresh = useCallback(() => {
    dashboardRefreshRef.current?.()
  }, [])

  const signOut = useCallback(() => {
    ;(async () => {
      const onAdmin = isAdminPath(location.pathname)
      try {
        await authLogout()
      } catch {
        // ignore
      } finally {
        setAuth(null)
        navigate(onAdmin ? '/admin' : '/')
      }
    })()
  }, [location.pathname, navigate, setAuth])

  const navigateToInboxWithPreset = useCallback(
    (preset) => {
      try {
        sessionStorage.setItem('cfp_inbox_peak_preset', JSON.stringify(preset || {}))
      } catch {
        // ignore
      }
      navigateToView('inbox')
    },
    [navigateToView],
  )

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('cfp_theme', theme)
  }, [theme])

  useEffect(() => {
    const cleanup = connectNotificationsStream((evt) => {
      if (evt?.type !== 'notification.created' || !evt?.notification) return
      const n = evt.notification
      const id = `${Date.now()}-${Math.random()}`
      setLiveToasts((prev) => [
        {
          id,
          title: n.title || 'New notification',
          body: n.body || '',
          href: n.href || 'notifications',
        },
        ...prev,
      ].slice(0, 3))
      playNotificationBeep()
      window.setTimeout(() => {
        setLiveToasts((prev) => prev.filter((t) => t.id !== id))
      }, 6500)
    })
    return cleanup
  }, [])

  if (!isAdminUI && isAdminPath(location.pathname)) {
    return <Navigate to="/" replace />
  }

  if (isAdminUI && isDashboardAgentPath(location.pathname)) {
    return <Navigate to="/admin" replace />
  }

  if (location.pathname === '/admin/channels' && !canAccessWebhooks) {
    return <Navigate to="/admin" replace />
  }

  const shellProps = {
    auth,
    isAdminUI,
    permissions,
    sidebarOpen,
    setSidebarOpen,
    theme,
    setTheme,
    signOut,
    showDashboardRefresh,
    onDashboardRefresh: handleDashboardRefresh,
  }

  return (
    <>
      <Routes>
        <Route element={<AppChrome {...shellProps} />}>
          <Route
            path="/"
            element={
              isAdminUI ? (
                <Navigate to="/admin" replace />
              ) : (
                <DashboardOverviewPage
                  userRole={auth?.role}
                  onNavigateToInsights={() => navigateToView('insights')}
                  onNavigateToInbox={navigateToInboxWithPreset}
                  registerRefresh={registerDashboardRefresh}
                />
              )
            }
          />
          <Route
            path="/insights"
            element={
              isAdminUI ? (
                <Navigate to="/admin" replace />
              ) : (
                <DashboardInsightsPage
                  userRole={auth?.role}
                  onNavigateBack={() => navigateToView('overview')}
                  onNavigateToInbox={navigateToInboxWithPreset}
                  registerRefresh={registerDashboardRefresh}
                />
              )
            }
          />
          <Route
            path="/inbox"
            element={isAdminUI ? <Navigate to="/admin" replace /> : <InboxPage onNavigate={navigateToView} />}
          />
          <Route
            path="/customer"
            element={isAdminUI ? <Navigate to="/admin" replace /> : <Customer360 onNavigate={navigateToView} />}
          />
          <Route
            path="/notifications"
            element={<Notifications isAdminUI={isAdminUI} onNavigate={navigateToView} />}
          />
          <Route path="/settings" element={<SettingsPage />} />

          <Route
            path="/admin"
            element={isAdminUI ? <AdminOverview auth={auth} onNavigate={navigateToView} /> : <Navigate to="/" replace />}
          />
          <Route
            path="/admin/channels"
            element={
              isAdminUI && canAccessWebhooks ? <Channels /> : <Navigate to={isAdminUI ? '/admin' : '/'} replace />
            }
          />
          <Route
            path="/admin/users"
            element={isAdminUI ? <AdminUsers /> : <Navigate to="/" replace />}
          />
          <Route
            path="/admin/roles"
            element={isAdminUI ? <AdminRoles /> : <Navigate to="/" replace />}
          />
          <Route
            path="/admin/integrations"
            element={isAdminUI ? <AdminIntegrations /> : <Navigate to="/" replace />}
          />
          <Route
            path="/admin/release-impact"
            element={isAdminUI ? <AdminReleaseImpact /> : <Navigate to="/" replace />}
          />
          <Route
            path="/admin/db"
            element={isAdminUI ? <AdminDbConnection /> : <Navigate to="/" replace />}
          />
          <Route
            path="/admin/enterprise-sso"
            element={isAdminUI ? <AdminEnterpriseAuth /> : <Navigate to="/" replace />}
          />

          <Route path="*" element={<Navigate to={isAdminUI ? '/admin' : '/'} replace />} />
        </Route>
      </Routes>

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
                    <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{t.body}</p>
                  ) : null}
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLiveToasts((prev) => prev.filter((x) => x.id !== t.id))
                        navigateToView(t.href || 'notifications')
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
    </>
  )
}

function App() {
  const [auth, setAuth] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const location = useLocation()
  const navigate = useNavigate()

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

  const handleAuthenticated = useCallback(
    (user) => {
      setAuth(user)
      const params = new URLSearchParams(location.search)
      const onAdminLogin = isAdminPath(location.pathname)
      let target = defaultPathForUser(user)
      if (onAdminLogin && userIsAdminUI(user)) target = '/admin'
      else if (onAdminLogin && !userIsAdminUI(user)) target = '/'
      navigate(target, { replace: true })
      if (params.has('enterprise_signed_in') || params.has('enterprise_error')) {
        window.history.replaceState({}, '', target)
      }
    },
    [location.pathname, location.search, navigate],
  )

  useEffect(() => {
    if (!auth?.email) return
    const params = new URLSearchParams(location.search)
    if (params.get('enterprise_signed_in') !== '1') return
    const target = defaultPathForUser(auth)
    navigate(target, { replace: true })
    window.history.replaceState({}, '', target)
  }, [auth, location.search, navigate])

  if (authLoading) {
    return <AuthLoadingScreen />
  }

  if (!auth?.email) {
    const path = location.pathname || ''
    if (path.startsWith('/verify-email') || path.startsWith('/reset-password')) {
      return <Navigate to="/" replace />
    }
    return (
      <AuthShell
        adminPortal={isAdminPath(location.pathname)}
        onAuthenticated={handleAuthenticated}
      />
    )
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="*" element={<AuthenticatedApp auth={auth} setAuth={setAuth} />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
