/**
 * Pure helpers extracted from Dashboard.jsx to keep the main component smaller.
 */

export function safeParseJson(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  if (typeof value !== 'string') return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
