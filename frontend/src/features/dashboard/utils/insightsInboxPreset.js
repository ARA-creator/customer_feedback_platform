/** Map insights range to inbox date_range (90d not supported in inbox yet). */
export function insightsRangeToDateRange(rangeDays) {
  const d = Number(rangeDays)
  if (d === 7) return '7d'
  if (d === 30) return '30d'
  if (d === 90) return '30d'
  return '30d'
}

export function buildThemePreset(themeKey, rangeDays) {
  const tag = String(themeKey || '').trim()
  if (!tag) return null
  return {
    insurance_tag: tag,
    date_range: insightsRangeToDateRange(rangeDays),
    sentiment: 'all',
  }
}

export function buildSourcePreset(sourceKey, rangeDays) {
  const src = String(sourceKey || '').trim().toLowerCase()
  if (!src) return null
  return {
    source: src,
    date_range: insightsRangeToDateRange(rangeDays),
    sentiment: 'all',
  }
}

export function buildCombinedPreset({ themeKey, sourceKey, rangeDays, sentiment = 'all' }) {
  const preset = {
    date_range: insightsRangeToDateRange(rangeDays),
    sentiment: sentiment || 'all',
  }
  const tag = String(themeKey || '').trim()
  const src = String(sourceKey || '').trim().toLowerCase()
  if (tag) preset.insurance_tag = tag
  if (src) preset.source = src
  if (!tag && !src) return null
  return preset
}

export function buildPeakPreset({ dow, hour, rangeDays }) {
  const preset = {}
  if (Number.isFinite(Number(dow))) preset.dow = Number(dow)
  if (Number.isFinite(Number(hour))) preset.hour = Number(hour)
  if (Number.isFinite(Number(rangeDays))) preset.range_days = Number(rangeDays)
  return preset
}

/** Peak presets use cfp_inbox_peak_preset; theme/source use cfp_inbox_anomaly_preset. */
export function inboxPresetStorageKey(preset) {
  const p = preset || {}
  const isPeak = Number.isFinite(Number(p.dow)) || Number.isFinite(Number(p.hour))
  return isPeak ? 'cfp_inbox_peak_preset' : 'cfp_inbox_anomaly_preset'
}
