export function normalizeRoleKey(value) {
  const v = String(value || '').toLowerCase()
  // Prefer manager/management views over CX if both match (e.g. "cx_manager").
  if (v.includes('manager') || v.includes('management')) return 'management'
  if (v.includes('cx')) return 'cx'
  if (v.includes('support')) return 'cx'
  if (v.includes('operation')) return 'operations'
  return 'management'
}

/**
 * Peak-time heatmap: hue from sentiment (red = negative-heavy, green = positive-heavy),
 * saturation/opacity from volume vs max cell count.
 */
export function getPeakHeatmapCellStyles(pos, neg, count, maxCount, isDarkMode) {
  const posN = Number(pos) || 0
  const negN = Number(neg) || 0
  const total = Number(count) || 0
  if (total <= 0) {
    return {
      style: undefined,
      classBg: isDarkMode ? 'bg-gray-900/30' : 'bg-gray-50',
      textClass: isDarkMode ? 'text-gray-500' : 'text-gray-400',
    }
  }
  const balance = Math.max(-1, Math.min(1, (posN - negN) / total))
  const volN = Math.min(1, total / Math.max(Number(maxCount) || 0, 1))
  const hue = 60 + 60 * balance
  const sat = Math.round(48 + volN * 47)
  const light = isDarkMode
    ? Math.round(28 + (1 - volN) * 24)
    : Math.round(90 - volN * 48)
  const alpha = isDarkMode ? 0.52 + volN * 0.43 : 0.42 + volN * 0.53
  const textClass = light > 54 ? 'text-gray-900 dark:text-gray-900' : 'text-white'
  return {
    style: { backgroundColor: `hsla(${hue}, ${sat}%, ${light}%, ${alpha})` },
    classBg: '',
    textClass,
  }
}
