/** Path <-> legacy view id mapping for Customer Pulse navigation. */

export const VIEW_PATHS = {
  overview: '/',
  inbox: '/inbox',
  insights: '/insights',
  notifications: '/notifications',
  settings: '/settings',
  customer: '/customer',
  channels: '/admin/channels',
  admin_overview: '/admin',
  admin_users: '/admin/users',
  admin_roles: '/admin/roles',
  admin_integrations: '/admin/integrations',
  admin_release_impact: '/admin/release-impact',
  admin_db: '/admin/db',
  admin_enterprise_auth: '/admin/enterprise-sso',
}

const PATH_TO_VIEW = Object.fromEntries(
  Object.entries(VIEW_PATHS).map(([view, path]) => [path, view]),
)

/** Longest-path-first for prefix matching (e.g. /admin/users before /admin). */
const SORTED_PATHS = Object.entries(VIEW_PATHS).sort((a, b) => b[1].length - a[1].length)

export function pathForView(view) {
  if (!view) return '/'
  const key = String(view).trim()
  if (VIEW_PATHS[key]) return VIEW_PATHS[key]
  if (key.startsWith('/')) return key
  return '/'
}

export function viewFromPathname(pathname) {
  const path = (pathname || '/').replace(/\/+$/, '') || '/'
  if (PATH_TO_VIEW[path]) return PATH_TO_VIEW[path]
  for (const [view, routePath] of SORTED_PATHS) {
    if (routePath !== '/' && (path === routePath || path.startsWith(`${routePath}/`))) {
      return view
    }
  }
  if (path === '/' || path === '') return 'overview'
  return null
}

export function isAdminPath(pathname) {
  const path = pathname || ''
  return path === '/admin' || path.startsWith('/admin/')
}

export function isDashboardAgentPath(pathname) {
  const view = viewFromPathname(pathname)
  return view === 'overview' || view === 'insights' || view === 'inbox'
}

export function userIsAdminUI(user) {
  const perms = Array.isArray(user?.permissions) ? user.permissions : []
  return (
    perms.includes('admin.manage_users') ||
    perms.includes('admin.manage_roles') ||
    perms.includes('admin.manage_integrations') ||
    String(user?.role || '').toLowerCase() === 'super_admin'
  )
}

export function defaultPathForUser(user) {
  return userIsAdminUI(user) ? '/admin' : '/'
}
