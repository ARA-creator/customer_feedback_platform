/** Shared display helpers for signed-in user UI. */

export function getUserInitials(email) {
  const local = String(email || '').split('@')[0] || 'U'
  const parts = local.split(/[._-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase() || 'U'
  }
  return local.slice(0, 2).toUpperCase()
}

export function displayNameFromEmail(email) {
  if (!email) return 'User'
  const local = String(email).split('@')[0] || 'User'
  const name = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ')
  if (!name) return 'User'
  return name.length > 28 ? `${name.slice(0, 25)}…` : name
}

export function formatUserRole(role) {
  const r = String(role || '').trim().toLowerCase()
  if (!r) return 'User'
  if (r === 'super_admin') return 'Admin'
  if (r === 'admin') return 'Admin'
  return r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
