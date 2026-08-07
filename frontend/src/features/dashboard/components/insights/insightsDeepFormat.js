export function fmtPct(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return `${Math.round(x * 1000) / 10}%`
}

export function fmtHours(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const v = Number(n)
  if (v < 1) return `${Math.round(v * 60)}m`
  return `${Math.round(v * 10) / 10}h`
}

export function fmtDelta(n, { pct = false } = {}) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const v = Number(n)
  const sign = v > 0 ? '+' : ''
  if (pct) return `${sign}${Math.round(v * 1000) / 10}pp`
  return `${sign}${Math.round(v * 100) / 100}`
}

export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
