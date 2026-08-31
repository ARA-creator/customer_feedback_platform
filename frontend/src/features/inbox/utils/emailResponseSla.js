/**
 * Resolve arrival/reply timestamps and response SLA status for inbox rows.
 *
 * Prefer actual email header times (metadata), fall back to platform timestamps.
 *
 * SLA channels (working time only — Mon–Fri 08:00–17:59 UTC):
 * - HNW email: Overdue when elapsed > 1 working day
 * - CX email: Overdue when elapsed > 2 working days
 * - Facebook, TikTok, Instagram, Jotform, WhatsApp: Overdue when elapsed > 1 working day
 */

import {
  WORKING_HOURS_PER_DAY,
  elapsedWorkingHours,
} from '../../../shared/utils/workingHours'

const HNW_SLA_WORKING_DAYS = 1
const CX_SLA_WORKING_DAYS = 2
const CHANNEL_1DAY_SLA_WORKING_DAYS = 1

/** Channels that use the 1 working-day SLA (besides HNW email). */
const CHANNEL_1DAY = new Set(['facebook', 'tiktok', 'instagram', 'jotform', 'whatsapp'])

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
  if (mailbox === 'hnw') return HNW_SLA_WORKING_DAYS
  if (mailbox === 'cx') return CX_SLA_WORKING_DAYS
  if (CHANNEL_1DAY.has(mailbox)) return CHANNEL_1DAY_SLA_WORKING_DAYS
  return null
}

export function formatSlaThresholdLabel(workingDays) {
  const n = Number(workingDays)
  if (!Number.isFinite(n) || n <= 0) return ''
  return n === 1 ? '1 working day' : `${n} working days`
}

/**
 * @returns {{
 *   status: 'Overdue'|'On track'|null,
 *   mailbox: string|null,
 *   thresholdWorkingDays: number|null,
 *   thresholdWorkingHours: number|null,
 *   elapsedWorkingHours: number|null,
 *   arrivalAt: Date|null,
 *   repliedAt: Date|null,
 * }}
 */
export function computeResponseSla(item, now = Date.now()) {
  const mailbox = resolveMailboxKind(item)
  const arrivalAt = resolveArrivalAt(item)
  const repliedAt = resolveRepliedAt(item)
  const thresholdWorkingDays = thresholdForMailbox(mailbox)

  if (!mailbox || !arrivalAt || thresholdWorkingDays == null) {
    return {
      status: null,
      mailbox,
      thresholdWorkingDays: null,
      thresholdWorkingHours: null,
      elapsedWorkingHours: null,
      arrivalAt,
      repliedAt,
    }
  }

  const endAt = repliedAt || new Date(Number(now))
  const elapsedWorkingHoursValue = elapsedWorkingHours(arrivalAt, endAt)
  const thresholdWorkingHours = thresholdWorkingDays * WORKING_HOURS_PER_DAY
  // Strictly greater than the threshold is Overdue; exact boundary stays On track.
  const status = elapsedWorkingHoursValue > thresholdWorkingHours ? 'Overdue' : 'On track'

  return {
    status,
    mailbox,
    thresholdWorkingDays,
    thresholdWorkingHours,
    elapsedWorkingHours: elapsedWorkingHoursValue,
    arrivalAt,
    repliedAt,
  }
}
