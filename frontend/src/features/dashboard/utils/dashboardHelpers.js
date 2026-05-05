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

export function kpiChangeText(abs, pctValue) {
  if (abs == null && pctValue == null) return null
  const absNum = typeof abs === 'number' && Number.isFinite(abs) ? abs : null
  const pctNum = typeof pctValue === 'number' && Number.isFinite(pctValue) ? pctValue : null
  if (absNum == null && pctNum == null) return null
  const direction =
    absNum != null
      ? absNum > 0
        ? 'Up'
        : absNum < 0
          ? 'Down'
          : 'Flat'
      : pctNum > 0
        ? 'Up'
        : pctNum < 0
          ? 'Down'
          : 'Flat'
  const absText = absNum != null ? `${Math.abs(absNum)}` : null
  const pctText =
    pctNum != null
      ? `${pctNum < 0 ? '−' : ''}${Math.abs(pctNum).toFixed(0)}%`
      : null
  if (direction === 'Flat') {
    return `Flat vs last week`
  }
  return `${direction} ${absText ?? ''}${pctText ? ` (${pctText})` : ''} vs last week`.trim()
}

/**
 * Week-over-week comparison, negative share, and alert list for the overview KPI strip.
 */
export function computeManagementInsights({
  mode,
  overviewTimeFilter,
  comparison,
  highPriority,
  responseMetrics,
  unknownSentimentCount,
}) {
  if (mode === 'overview' && overviewTimeFilter !== 'all') {
    return {
      thisWeek: null,
      lastWeek: null,
      negShare: null,
      negShareDeltaPoints: null,
      deltas: {
        total: { abs: null, pct: null },
        positive: { abs: null, pct: null },
        negative: { abs: null, pct: null },
        neutral: { abs: null, pct: null },
        highPriority: { abs: null, pct: null },
      },
      alerts: [],
    }
  }

  const tw = comparison?.this_week
  const lw = comparison?.last_week

  const safeNum = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)
  const pct = (n, d) => {
    const denom = safeNum(d)
    if (denom <= 0) return null
    return (safeNum(n) / denom) * 100
  }
  const deltaAbs = (a, b) => safeNum(a) - safeNum(b)
  const deltaPct = (a, b) => {
    const base = safeNum(b)
    if (base === 0) return null
    return ((safeNum(a) - base) / base) * 100
  }

  const thisTotal = safeNum(tw?.total)
  const lastTotal = safeNum(lw?.total)
  const thisPos = safeNum(tw?.positive)
  const lastPos = safeNum(lw?.positive)
  const thisNeg = safeNum(tw?.negative)
  const lastNeg = safeNum(lw?.negative)
  const thisNeu = safeNum(tw?.neutral)
  const lastNeu = safeNum(lw?.neutral)
  const thisHigh = safeNum(highPriority)
  const lastHigh = null

  const thisNegShare = pct(thisNeg, thisTotal)
  const lastNegShare = pct(lastNeg, lastTotal)
  const thisPosShare = pct(thisPos, thisTotal)
  const lastPosShare = pct(lastPos, lastTotal)

  const alerts = []
  const negShareDelta = thisNegShare != null && lastNegShare != null ? thisNegShare - lastNegShare : null
  if (negShareDelta != null && negShareDelta >= 7) {
    alerts.push({
      id: 'neg_share_spike',
      title: 'Negative share spike',
      message: `Negative share is up ${negShareDelta.toFixed(1)} points vs last week.`,
      variant: 'warning',
    })
  }
  const posShareDelta = thisPosShare != null && lastPosShare != null ? thisPosShare - lastPosShare : null
  if (posShareDelta != null && posShareDelta >= 7) {
    alerts.push({
      id: 'pos_share_spike',
      title: 'Positive share spike',
      message: `Positive share is up ${posShareDelta.toFixed(1)} points vs last week.`,
      variant: 'warning',
    })
  }
  if (posShareDelta != null && posShareDelta <= -7) {
    alerts.push({
      id: 'pos_share_drop',
      title: 'Positive share drop',
      message: `Positive share is down ${Math.abs(posShareDelta).toFixed(1)} points vs last week.`,
      variant: 'warning',
    })
  }

  const posAbsDelta = thisPos - lastPos
  const posPctDelta = lastPos > 0 ? ((thisPos - lastPos) / lastPos) * 100 : null
  if (posPctDelta != null && Math.abs(posPctDelta) >= 30 && Math.abs(posAbsDelta) >= 5) {
    alerts.push({
      id: posPctDelta > 0 ? 'pos_volume_spike' : 'pos_volume_drop',
      title: posPctDelta > 0 ? 'Positive volume spike' : 'Positive volume drop',
      message:
        posPctDelta > 0
          ? `Positive feedback is up ${Math.abs(posAbsDelta)} (${Math.abs(posPctDelta).toFixed(0)}%) vs last week.`
          : `Positive feedback is down ${Math.abs(posAbsDelta)} (${Math.abs(posPctDelta).toFixed(0)}%) vs last week.`,
      variant: 'warning',
    })
  }
  const hpAge = responseMetrics?.avg_age_hours_high_priority
  if (hpAge != null && Number(hpAge) >= 24) {
    alerts.push({
      id: 'hp_age',
      title: 'High-priority backlog aging',
      message: `High-priority feedback average age is ${hpAge}h.`,
      variant: 'warning',
    })
  }
  const unknownCount = Number(unknownSentimentCount ?? 0)
  if (unknownCount > 0) {
    alerts.push({
      id: 'unknown_sentiment',
      title: 'Some feedback is unlabeled',
      message: `${unknownCount} item(s) have unknown sentiment.`,
      variant: 'info',
    })
  }

  return {
    thisWeek: tw || null,
    lastWeek: lw || null,
    negShare: thisNegShare,
    negShareDeltaPoints: negShareDelta,
    deltas: {
      total: { abs: deltaAbs(thisTotal, lastTotal), pct: deltaPct(thisTotal, lastTotal) },
      positive: { abs: deltaAbs(thisPos, lastPos), pct: deltaPct(thisPos, lastPos) },
      negative: { abs: deltaAbs(thisNeg, lastNeg), pct: deltaPct(thisNeg, lastNeg) },
      neutral: { abs: deltaAbs(thisNeu, lastNeu), pct: deltaPct(thisNeu, lastNeu) },
      highPriority: { abs: lastHigh != null ? deltaAbs(thisHigh, lastHigh) : null, pct: null },
    },
    alerts,
  }
}
