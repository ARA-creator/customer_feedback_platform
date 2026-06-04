const SKILL_COLORS = [
  'border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100',
  'border-teal-200/80 bg-teal-50 text-teal-900 dark:border-teal-800/50 dark:bg-teal-950/40 dark:text-teal-100',
  'border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-100',
  'border-violet-200/80 bg-violet-50 text-violet-900 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-100',
  'border-rose-200/80 bg-rose-50 text-rose-900 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-100',
]

export function userDisplayName(user) {
  const name = String(user?.full_name || '').trim()
  if (name) return name
  const email = String(user?.email || '')
  if (email.includes('@')) return email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return email || 'User'
}

export function userInitials(user) {
  const name = userDisplayName(user)
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (parts[0]?.slice(0, 2) || 'U').toUpperCase()
}

export function skillPillClass(index) {
  return SKILL_COLORS[index % SKILL_COLORS.length]
}

export function workloadBarClass(pct) {
  const n = Number(pct) || 0
  if (n >= 85) return 'bg-rose-500'
  if (n >= 55) return 'bg-amber-500'
  return 'bg-emerald-500'
}

export function slaHealthPillClass(pct) {
  const n = Number(pct) || 0
  if (n >= 90) return 'border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200'
  if (n >= 75) return 'border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100'
  return 'border-rose-200/80 bg-rose-50 text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-200'
}

export function formatRelativeLogin(iso) {
  if (!iso) return 'Never'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const sec = Math.round((Date.now() - t) / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function mapActivityToTimeline(item) {
  const action = String(item?.action || '').toLowerCase()
  const meta = item?.meta && typeof item.meta === 'object' ? item.meta : {}
  const fid = meta.feedback_id || meta.feedbackId
  const feedbackLabel = fid ? `#${fid}` : ''

  if (action.includes('resolve') || action.includes('closed')) {
    return {
      tone: 'emerald',
      title: feedbackLabel ? `Closed feedback ${feedbackLabel}` : 'Closed feedback',
      subtitle: item.target_display || meta.note || 'Resolution updated',
    }
  }
  if (action.includes('reply') || action.includes('draft')) {
    return {
      tone: 'sky',
      title: feedbackLabel ? `Reply on feedback ${feedbackLabel}` : 'Reply activity',
      subtitle: item.target_display || 'Customer follow-up',
    }
  }
  if (action.includes('escalat')) {
    return {
      tone: 'amber',
      title: feedbackLabel ? `Escalated feedback ${feedbackLabel}` : 'Escalated issue',
      subtitle: meta.reason || item.target_display || 'Escalation',
    }
  }
  if (action.includes('role') || action.includes('permission')) {
    return {
      tone: 'violet',
      title: 'Updated access',
      subtitle: item.target_display || action.replace(/^admin\./, ''),
    }
  }
  if (action.includes('user.create') || action.includes('approve')) {
    return {
      tone: 'violet',
      title: 'User account change',
      subtitle: item.target_display || action.replace(/^admin\./, ''),
    }
  }
  if (action.includes('assign')) {
    return {
      tone: 'sky',
      title: feedbackLabel ? `Assigned feedback ${feedbackLabel}` : 'Assignment',
      subtitle: item.target_display || 'Workflow update',
    }
  }
  return {
    tone: 'gray',
    title: action.replace(/^admin\./, '').replace(/\./g, ' ') || 'Activity',
    subtitle: item.target_display || item.target_email || '',
  }
}

export function filterDirectoryUsers(users, filters) {
  const q = String(filters.q || '').trim().toLowerCase()
  const team = filters.team || 'all'
  const region = filters.region || 'all'
  const role = filters.role || 'all'
  const skill = filters.skill || 'all'
  const workload = filters.workload || 'all'
  const sla = filters.sla || 'all'

  return (users || []).filter((u) => {
    if (q) {
      const hay = `${u.full_name || ''} ${u.email || ''} ${u.role_label || ''} ${u.team_label || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (team !== 'all' && (u.team || '') !== team) return false
    if (region !== 'all' && (u.region || '') !== region) return false
    if (role !== 'all') {
      const roles = Array.isArray(u.roles) ? u.roles : []
      if (!roles.includes(role) && u.role !== role) return false
    }
    if (skill !== 'all') {
      const skills = Array.isArray(u.skills) ? u.skills : []
      if (!skills.some((s) => String(s).toLowerCase() === skill.toLowerCase())) return false
    }
    const w = Number(u.workload_pct) || 0
    if (workload === 'low' && w >= 55) return false
    if (workload === 'medium' && (w < 55 || w >= 85)) return false
    if (workload === 'high' && w < 85) return false
    const slaPct = Number(u.sla_health_pct) || 0
    if (sla === 'healthy' && slaPct < 90) return false
    if (sla === 'watch' && (slaPct < 75 || slaPct >= 90)) return false
    if (sla === 'risk' && slaPct >= 75) return false
    return true
  })
}

export function uniqueFilterOptions(users) {
  const teams = new Set()
  const regions = new Set()
  const roles = new Set()
  const skills = new Set()
  for (const u of users || []) {
    if (u.team) teams.add(u.team)
    if (u.region) regions.add(u.region)
    for (const r of u.roles || []) roles.add(r)
    if (u.role) roles.add(u.role)
    for (const s of u.skills || []) skills.add(s)
  }
  return {
    teams: Array.from(teams).sort(),
    regions: Array.from(regions).sort(),
    roles: Array.from(roles).sort(),
    skills: Array.from(skills).sort(),
  }
}
