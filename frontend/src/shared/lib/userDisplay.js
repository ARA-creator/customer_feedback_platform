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
  if (r === 'cx_manager') return 'CX Manager'
  if (r === 'agent') return 'Agent'
  return r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function displayNameFromUser(user) {
  const full = String(user?.full_name || '').trim()
  if (full) return full.length > 32 ? `${full.slice(0, 29)}…` : full
  return displayNameFromEmail(user?.email)
}

export function getUserInitialsFromUser(user) {
  const full = String(user?.full_name || '').trim()
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase() || 'U'
    }
    return full.slice(0, 2).toUpperCase()
  }
  return getUserInitials(user?.email)
}

export function formatMemberSince(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

export function formatLastActive(iso) {
  if (!iso) return 'Recently'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'Recently'
  const sec = Math.round((Date.now() - t) / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 14) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}
