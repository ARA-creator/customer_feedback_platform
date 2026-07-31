/** Monday-start ISO date helpers for the Reports builder. */

export function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function startOfWeek(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - diff)
  return d
}

export function endOfWeek(date = new Date()) {
  const start = startOfWeek(date)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return end
}

export function thisWeekRange() {
  const now = new Date()
  return { dateFrom: toISODate(startOfWeek(now)), dateTo: toISODate(now) }
}

export function formatDisplayRange(dateFrom, dateTo) {
  const fmt = (iso) => {
    if (!iso) return ''
    const d = new Date(`${iso}T12:00:00`)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }
  if (!dateFrom && !dateTo) return 'All time'
  if (dateFrom && dateTo) return `${fmt(dateFrom)} – ${fmt(dateTo)}`
  if (dateFrom) return `From ${fmt(dateFrom)}`
  return `Until ${fmt(dateTo)}`
}

export function formatTrendTick(iso) {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
