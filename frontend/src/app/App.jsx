import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from '../shared/components/layout/Sidebar'
import Header from '../shared/components/layout/Header'
import Channels from '../features/channels/components/Channels'
import AuthShell from '../features/auth/components/AuthShell'
import { authLogout, authMe } from '../features/auth/services/auth.api'
import { markIdleLogout, useIdleLogout } from '../features/auth/hooks/useIdleLogout'
import { captureApiSessionFromUrl } from '../shared/lib/authSession'
import { useNotificationPrefs } from '../features/notifications/hooks/useNotificationPrefs'
import { connectNotificationsStream } from '../features/notifications/services/notifications.api'
import { useLiveNotificationToasts } from '../features/notifications/hooks/useLiveNotificationToasts'
import AdminUsers from '../features/admin/components/AdminUsers'
import AdminRoles from '../features/admin/components/AdminRoles'
import AdminOverview from '../features/admin/components/AdminOverview'
import AdminDbConnection from '../features/admin/components/AdminDbConnection'
import AdminEnterpriseAuth from '../features/admin/components/AdminEnterpriseAuth'
import AdminUserActivity from '../features/admin/components/AdminUserActivity'
import ReportsPage from '../pages/reports/ReportsPage'
import Notifications from '../features/notifications/components/Notifications'
import Customer360 from '../features/customers/components/Customer360'
import { AuthLoadingScreen } from '../shared/components/ui/LoadingSkeleton'
import ErrorBoundary from '../shared/components/ui/ErrorBoundary'
import DashboardOverviewPage from '../pages/dashboard/Overview'
import InboxPage from '../pages/inbox/Inbox'
import SettingsLayout from '../pages/settings/SettingsLayout'
import SettingsAccountPage from '../pages/settings/SettingsAccountPage'
import SettingsDisplayPage from '../pages/settings/SettingsDisplayPage'
import SettingsHelpPage from '../pages/settings/SettingsHelpPage'
import SettingsInboxPage from '../pages/settings/SettingsInboxPage'
import SettingsNotificationsPage from '../pages/settings/SettingsNotificationsPage'
import SettingsSecurityPage from '../pages/settings/SettingsSecurityPage'
import { isQuietHoursActive, loadNotificationUiPrefs } from '../shared/lib/notificationUiPreferences'
import { shouldShowLiveToast } from '../features/notifications/utils/toastPolicy'
import { notificationSoundsEnabled } from '../shared/lib/displayPreferences'
import {
  defaultPathForUser,
  isAdminPath,
  userCanViewReports,
  userIsAdminUI,
  viewFromPathname,
  isAgentPortalPath,
} from './routes'
import { useAppNavigate } from './useAppNavigate'
import { DisplayPreferencesProvider, useDisplayPreferences } from '../shared/context/DisplayPreferencesContext'

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

const HEADER_TITLES = {
  overview: 'Feedback Dashboard',
  inbox: 'Feedback Inbox',
  notifications: 'Notifications',
  settings: 'Settings',
  customer: 'Customer 360',
  reports: 'Reports',
  admin_overview: 'Admin',
  channels: 'Channels',
  admin_users: 'Users',
  admin_roles: 'Roles & permissions',
  admin_db: 'Database connection',
  admin_enterprise_auth: 'Enterprise SSO',
  admin_activity: 'User activity',
}

function AppChrome({
  auth,
  isAdminUI,
  permissions,
  sidebarOpen,
  setSidebarOpen,
  signOut,
  showDashboardRefresh,
  onDashboardRefresh,
}) {
  const { resolvedTheme, toggleTheme } = useDisplayPreferences()
  const location = useLocation()
  const currentView = viewFromPathname(location.pathname)
  const headerTitle = HEADER_TITLES[currentView] || 'Feedback Dashboard'

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
        permissions={permissions}
        userRole={auth?.role}
        isAdminUser={isAdminUI}
        canAccessWebhooks={permissions.includes('admin.manage_integrations') || String(auth?.role || '').toLowerCase() === 'super_admin'}
        user={auth ? { id: auth.id, email: auth.email, role: auth.role } : null}
      />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative z-10">
        <Header
          title={headerTitle}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          theme={resolvedTheme}
          onToggleTheme={toggleTheme}
          showRefresh={showDashboardRefresh}
          onRefresh={onDashboardRefresh}
          user={auth ? { id: auth.id, email: auth.email, role: auth.role } : null}
          onSignOut={signOut}
          hideAgentLinks={isAdminUI}
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
  const canViewReports = useMemo(() => userCanViewReports(auth), [auth])
  const currentView = viewFromPathname(location.pathname)
  const showDashboardRefresh =
    !isAdminUI && (currentView === 'overview' || currentView === 'reports')

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

  const signOutFromIdle = useCallback(() => {
    markIdleLogout()
    signOut()
  }, [signOut])

  useIdleLogout({ enabled: Boolean(auth?.email), onIdle: signOutFromIdle })

  const { realtimeEnabled, deliveryPrefs, loaded: notificationPrefsLoaded } = useNotificationPrefs()

  const pushLiveToast = useCallback((n) => {
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
    if (notificationSoundsEnabled()) {
      playNotificationBeep()
    }
    window.setTimeout(() => {
      setLiveToasts((prev) => prev.filter((t) => t.id !== id))
    }, 6500)
  }, [])

  // Always keep unread polling available for the sidebar badge (independent of toast prefs).
  const { handleStreamEvent } = useLiveNotificationToasts({
    enabled: !isAdminUI && notificationPrefsLoaded,
    deliveryPrefs,
    onToast: (n) => {
      if (!realtimeEnabled) return
      pushLiveToast(n)
    },
  })

  const navigateToInboxWithPreset = useCallback(
    (preset) => {
      try {
        const p = preset || {}
        const isPeak = Number.isFinite(Number(p.dow)) || Number.isFinite(Number(p.hour))
        const key = isPeak ? 'cfp_inbox_peak_preset' : 'cfp_inbox_anomaly_preset'
        sessionStorage.setItem(key, JSON.stringify(p))
      } catch {
        // ignore
      }
      navigateToView('inbox')
    },
    [navigateToView],
  )

  useEffect(() => {
    if (isAdminUI || !notificationPrefsLoaded) return undefined
    return connectNotificationsStream(handleStreamEvent)
  }, [isAdminUI, notificationPrefsLoaded, handleStreamEvent])

  if (!isAdminUI && isAdminPath(location.pathname)) {
    return <Navigate to="/" replace />
  }

  if (isAdminUI && isAgentPortalPath(location.pathname)) {
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
              <DashboardOverviewPage
                userRole={auth?.role}
                onNavigateToInsights={() => navigate('/reports?tab=insights')}
                onNavigateToInbox={navigateToInboxWithPreset}
                registerRefresh={registerDashboardRefresh}
              />
            }
          />
          <Route path="/insights" element={<Navigate to="/reports?tab=insights" replace />} />
          <Route path="/inbox" element={<InboxPage onNavigate={navigateToView} />} />
          <Route path="/customer" element={<Customer360 onNavigate={navigateToView} />} />
          <Route
            path="/notifications"
            element={<Notifications isAdminUI={isAdminUI} onNavigate={navigateToView} />}
          />
          <Route path="/settings" element={<SettingsLayout auth={auth} />}>
            <Route index element={<Navigate to="account" replace />} />
            <Route path="account" element={<SettingsAccountPage auth={auth} />} />
            <Route path="display" element={<SettingsDisplayPage auth={auth} />} />
            <Route path="notifications" element={<SettingsNotificationsPage />} />
            <Route path="inbox" element={<SettingsInboxPage />} />
            <Route path="security" element={<SettingsSecurityPage auth={auth} />} />
            <Route path="help" element={<SettingsHelpPage auth={auth} />} />
          </Route>
          <Route
            path="/reports"
            element={
              canViewReports ? (
                <ReportsPage
                  userRole={auth?.role}
                  onNavigateToInbox={navigateToInboxWithPreset}
                  registerRefresh={registerDashboardRefresh}
                />
              ) : (
                <Navigate to={isAdminUI ? '/admin' : '/'} replace />
              )
            }
          />

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
          <Route path="/admin/integrations" element={<Navigate to="/admin/channels" replace />} />
          <Route
            path="/admin/db"
            element={isAdminUI ? <AdminDbConnection /> : <Navigate to="/" replace />}
          />
          <Route
            path="/admin/enterprise-sso"
            element={isAdminUI ? <AdminEnterpriseAuth /> : <Navigate to="/" replace />}
          />
          <Route path="/admin/reply-approvals" element={<Navigate to="/admin" replace />} />
          <Route
            path="/admin/activity"
            element={isAdminUI ? <AdminUserActivity /> : <Navigate to="/" replace />}
          />

          <Route path="*" element={<Navigate to={isAdminUI ? '/admin' : '/'} replace />} />
        </Route>
      </Routes>

      {liveToasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[60] space-y-2 w-[min(92vw,22rem)]">
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
    captureApiSessionFromUrl()
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
    const onAuthUpdated = (e) => {
      const user = e?.detail?.user
      if (!user?.id) return
      setAuth((prev) => (prev ? { ...prev, ...user } : user))
    }
    window.addEventListener('cfp-auth-updated', onAuthUpdated)
    return () => window.removeEventListener('cfp-auth-updated', onAuthUpdated)
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

  let content = <AuthLoadingScreen />
  if (!authLoading) {
    if (!auth?.email) {
      const path = location.pathname || ''
      content =
        path.startsWith('/verify-email') || path.startsWith('/reset-password') ? (
          <Navigate to="/" replace />
        ) : (
      <AuthShell
            adminPortal={isAdminPath(location.pathname)}
            onAuthenticated={handleAuthenticated}
      />
    )
    } else {
      content = <Routes><Route path="*" element={<AuthenticatedApp auth={auth} setAuth={setAuth} />} /></Routes>
    }
  }

  return (
    <ErrorBoundary>
      <DisplayPreferencesProvider>{content}</DisplayPreferencesProvider>
    </ErrorBoundary>
  )
}

export default App
