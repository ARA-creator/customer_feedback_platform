/**
 * Resolve arrival/reply timestamps and HNW/CX response SLA status for inbox rows.
 *
 * Prefer actual email header times (metadata), fall back to platform timestamps.
 */

const HNW_SLA_HOURS = 24
const CX_SLA_HOURS = 48

export function parseTimestamp(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isFinite(t) ? value : null
  }
  const raw = String(value).trim()
  if (!raw) return null
  const d = new Date(raw)
  return Number.isFinite(d.getTime()) ? d : null
}

function channelMeta(item) {
  return item?.channel_metadata && typeof item.channel_metadata === 'object'
    ? item.channel_metadata
    : {}
}

/**
 * Normalize mailbox channel to 'hnw' | 'cx' | null.
 */
export function resolveMailboxKind(item) {
  const meta = channelMeta(item)
  const labels = [
    item?.channel_label,
    meta.channel_label,
    meta.mailbox_label,
    item?.source_group,
    item?.source,
  ]
    .map((v) => String(v || '').trim().toLowerCase())
    .filter(Boolean)

  for (const label of labels) {
    if (label === 'cx' || label === 'cx_email' || label.includes('cx email')) return 'cx'
    if (
      label === 'hnw' ||
      label === 'hnw_email' ||
      label.includes('hnw')
    ) {
      return 'hnw'
    }
  }
  return null
}

export function resolveArrivalAt(item) {
  const meta = channelMeta(item)
  return parseTimestamp(meta.email_date) || parseTimestamp(item?.created_at)
}

export function resolveRepliedAt(item) {
  const meta = channelMeta(item)
  const officer = meta.officer_reply && typeof meta.officer_reply === 'object' ? meta.officer_reply : {}
  return (
    parseTimestamp(officer.sent_date) ||
    parseTimestamp(item?.replied_at) ||
    parseTimestamp(officer.detected_at)
  )
}

/**
 * Format a Date for display with lowercase am/pm.
 */
export function formatSlaDateTime(value) {
  const d = parseTimestamp(value)
  if (!d) return ''
  try {
    const formatted = d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    return String(formatted).replace(/\b(AM|PM)\b/g, (m) => m.toLowerCase())
  } catch {
    return d.toISOString()
  }
}

/**
 * @returns {{ status: 'Overdue'|'On track'|null, mailbox: 'hnw'|'cx'|null, thresholdHours: number|null, elapsedHours: number|null, arrivalAt: Date|null, repliedAt: Date|null }}
 */
export function computeResponseSla(item, now = Date.now()) {
  const mailbox = resolveMailboxKind(item)
  const arrivalAt = resolveArrivalAt(item)
  const repliedAt = resolveRepliedAt(item)

  if (!mailbox || !arrivalAt) {
    return {
      status: null,
      mailbox,
      thresholdHours: null,
      elapsedHours: null,
      arrivalAt,
      repliedAt,
    }
  }

  const thresholdHours = mailbox === 'hnw' ? HNW_SLA_HOURS : CX_SLA_HOURS
  const endMs = repliedAt ? repliedAt.getTime() : Number(now)
  const startMs = arrivalAt.getTime()
  const elapsedMs = Math.max(0, endMs - startMs)
  const elapsedHours = elapsedMs / (1000 * 60 * 60)
  // Strictly greater than the threshold is Overdue; exact boundary stays On track.
  const status = elapsedHours > thresholdHours ? 'Overdue' : 'On track'

  return {
    status,
    mailbox,
    thresholdHours,
    elapsedHours,
    arrivalAt,
    repliedAt,
  }
}
