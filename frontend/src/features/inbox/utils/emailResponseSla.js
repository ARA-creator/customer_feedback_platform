/**
 * Resolve arrival/reply timestamps and response SLA status for inbox rows.
 *
 * Prefer actual email header times (metadata), fall back to platform timestamps.
 *
 * SLA channels:
 * - HNW email: Overdue when elapsed > 24h
 * - CX email: Overdue when elapsed > 48h
 * - Facebook, TikTok, Instagram, Jotform, WhatsApp: Overdue when elapsed > 24h
 */

const HNW_SLA_HOURS = 24
const CX_SLA_HOURS = 48
const CHANNEL_24H_SLA_HOURS = 24

/** Channels that use the 24h SLA (besides HNW email). */
const CHANNEL_24H = new Set(['facebook', 'tiktok', 'instagram', 'jotform', 'whatsapp'])

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
 * Normalize channel to an SLA key: 'hnw' | 'cx' | social/form keys | null.
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
    // Email mailboxes first so HNW/CX stay exact.
    if (label === 'cx' || label === 'cx_email' || label.includes('cx email')) return 'cx'
    if (label === 'hnw' || label === 'hnw_email' || label.includes('hnw')) return 'hnw'

    if (label === 'facebook' || label.includes('facebook') || label === 'fb') return 'facebook'
    if (label === 'tiktok' || label.includes('tiktok')) return 'tiktok'
    if (label === 'instagram' || label.includes('instagram') || label === 'ig') return 'instagram'
    if (label === 'jotform' || label.includes('jotform')) return 'jotform'
    if (label === 'whatsapp' || label.includes('whatsapp') || label === 'wa') return 'whatsapp'
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

export function slaChannelLabel(mailbox) {
  if (mailbox === 'hnw') return 'HNW'
  if (mailbox === 'cx') return 'CX'
  if (mailbox === 'facebook') return 'Facebook'
  if (mailbox === 'tiktok') return 'TikTok'
  if (mailbox === 'instagram') return 'Instagram'
  if (mailbox === 'jotform') return 'Jotform'
  if (mailbox === 'whatsapp') return 'WhatsApp'
  return mailbox || ''
}

function thresholdForMailbox(mailbox) {
  if (mailbox === 'hnw') return HNW_SLA_HOURS
  if (mailbox === 'cx') return CX_SLA_HOURS
  if (CHANNEL_24H.has(mailbox)) return CHANNEL_24H_SLA_HOURS
  return null
}

/**
 * @returns {{ status: 'Overdue'|'On track'|null, mailbox: string|null, thresholdHours: number|null, elapsedHours: number|null, arrivalAt: Date|null, repliedAt: Date|null }}
 */
export function computeResponseSla(item, now = Date.now()) {
  const mailbox = resolveMailboxKind(item)
  const arrivalAt = resolveArrivalAt(item)
  const repliedAt = resolveRepliedAt(item)
  const thresholdHours = thresholdForMailbox(mailbox)

  if (!mailbox || !arrivalAt || thresholdHours == null) {
    return {
      status: null,
      mailbox,
      thresholdHours: null,
      elapsedHours: null,
      arrivalAt,
      repliedAt,
    }
  }

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
