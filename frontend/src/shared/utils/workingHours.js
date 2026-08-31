/** Mon–Fri, 08:00–17:59 UTC — matches backend working_hours.py */
export const WORKING_DOW = [0, 1, 2, 3, 4]
export const WORKING_DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
export const WORKING_HOUR_START = 8
export const WORKING_HOUR_END = 18
export const WORKING_HOURS = Array.from(
  { length: WORKING_HOUR_END - WORKING_HOUR_START },
  (_, i) => WORKING_HOUR_START + i,
)
export const WORKING_HOURS_PER_DAY = WORKING_HOURS.length
export const WORKING_HOURS_LABEL = 'Mon–Fri, 08:00–17:59 UTC'

export function pyWeekdayFromUtc(date) {
  return (date.getUTCDay() + 6) % 7
}

export function isWorkingSlot(dow, hour) {
  return WORKING_DOW.includes(Number(dow)) && Number(hour) >= WORKING_HOUR_START && Number(hour) < WORKING_HOUR_END
}

function utcMs(y, mo, d, h, mi = 0, s = 0, ms = 0) {
  return Date.UTC(y, mo, d, h, mi, s, ms)
}

function skipToNextWorkingStart(ms) {
  const dt = new Date(ms)
  const dow = pyWeekdayFromUtc(dt)
  const hour = dt.getUTCHours()
  if (WORKING_DOW.includes(dow) && hour < WORKING_HOUR_START) {
    return utcMs(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), WORKING_HOUR_START, 0, 0)
  }
  let dayStart = utcMs(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate() + 1, WORKING_HOUR_START, 0, 0)
  for (let i = 0; i < 14; i += 1) {
    const p = new Date(dayStart)
    if (WORKING_DOW.includes(pyWeekdayFromUtc(p))) return dayStart
    dayStart += 86400000
  }
  return dayStart
}

/**
 * Elapsed milliseconds counting only Mon–Fri 08:00–17:59 UTC.
 */
export function elapsedWorkingMs(start, end) {
  const s = start instanceof Date ? start : new Date(start)
  const e = end instanceof Date ? end : new Date(end)
  if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime()) || e <= s) return 0

  let total = 0
  let cursor = s.getTime()
  const endMs = e.getTime()

  while (cursor < endMs) {
    const dt = new Date(cursor)
    const dow = pyWeekdayFromUtc(dt)
    const hour = dt.getUTCHours()

    if (isWorkingSlot(dow, hour)) {
      const hourEnd = utcMs(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), hour + 1, 0, 0)
      const dayWorkEnd = utcMs(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), WORKING_HOUR_END, 0, 0)
      const segEnd = Math.min(hourEnd, dayWorkEnd, endMs)
      total += segEnd - cursor
      cursor = segEnd
    } else {
      cursor = skipToNextWorkingStart(cursor)
    }
  }
  return total
}

export function elapsedWorkingHours(start, end) {
  return elapsedWorkingMs(start, end) / (1000 * 60 * 60)
}
