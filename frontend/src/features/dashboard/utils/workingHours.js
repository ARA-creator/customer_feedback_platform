/** Mon–Fri, 08:00–17:59 UTC — matches backend working_hours.py */
export const WORKING_DOW = [0, 1, 2, 3, 4]
export const WORKING_DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
export const WORKING_HOUR_START = 8
export const WORKING_HOUR_END = 18
export const WORKING_HOURS = Array.from(
  { length: WORKING_HOUR_END - WORKING_HOUR_START },
  (_, i) => WORKING_HOUR_START + i,
)

export function isWorkingSlot(dow, hour) {
  return WORKING_DOW.includes(Number(dow)) && Number(hour) >= WORKING_HOUR_START && Number(hour) < WORKING_HOUR_END
}

export const WORKING_HOURS_LABEL = 'Mon–Fri, 08:00–17:59 UTC'
