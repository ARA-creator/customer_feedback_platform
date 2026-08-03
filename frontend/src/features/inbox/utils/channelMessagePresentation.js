/* Channel-aware presentation helpers for inbox list + detail. */

function metaOf(item) {
  const m = item?.channel_metadata
  return m && typeof m === 'object' ? m : {}
}

export function channelKind(item) {
  const meta = item?.channel_metadata && typeof item.channel_metadata === 'object' ? item.channel_metadata : {}
  const s = String(item?.source_group || item?.source || '')
    .trim()
    .toLowerCase()
  // Prefer metadata: ingested email always carries subject / sender even if source is odd.
  if (
    meta.email_subject ||
    meta.sender_email ||
    meta.email_date ||
    meta.message_id
  ) {
    return 'email'
  }
  if (!s) return 'generic'
  if (s === 'email' || s.includes('email')) return 'email'
  if (s.includes('whatsapp')) return 'whatsapp'
  if (s.includes('facebook')) return 'facebook'
  if (s.includes('instagram')) return 'instagram'
  if (s === 'x' || s.includes('twitter') || s.startsWith('x ') || s.startsWith('x-')) return 'x'
  if (s.includes('tiktok')) return 'tiktok'
  if (s.includes('jotform') || s.includes('form') || s === 'web' || s.startsWith('web')) return 'form'
  return 'generic'
}

function firstMessageLine(item) {
  const msg = String(item?.message || item?.message_preview || '').trim()
  if (!msg) return ''
  const line = msg.split(/\r?\n/).find((l) => l.trim()) || msg
  return line.trim()
}

/** Strip a leading subject line from email body when it duplicates the subject header. */
export function emailBodyWithoutSubject(item) {
  const meta = metaOf(item)
  const subject = String(meta.email_subject || '').trim()
  let body = String(item?.message || item?.message_preview || '').trim()
  if (!body) return ''
  if (subject) {
    const lines = body.split(/\r?\n/)
    const first = (lines[0] || '').trim()
    if (first && first.toLowerCase() === subject.toLowerCase()) {
      body = lines.slice(1).join('\n').replace(/^\n+/, '')
    }
  }
  return body
}

export function channelMessageTitle(item) {
  const kind = channelKind(item)
  const meta = metaOf(item)
  if (kind === 'email') {
    const subject = String(meta.email_subject || '').trim()
    if (subject) return subject.length > 72 ? `${subject.slice(0, 72)}…` : subject
  }
  const line = firstMessageLine(item)
  if (!line) return 'Feedback'
  return line.length > 72 ? `${line.slice(0, 72)}…` : line
}

export function channelMessageSubtitle(item) {
  const kind = channelKind(item)
  const meta = metaOf(item)
  if (kind === 'email') {
    const name = String(meta.sender_name || meta.author_handle || meta.customer_label || '').trim()
    const email = String(meta.sender_email || '').trim()
    if (name && email) return `${name} · ${email}`
    return name || email || ''
  }
  if (kind === 'whatsapp') {
    return String(
      meta.phone ||
        meta.from_number ||
        meta.customer_label ||
        meta.author_handle ||
        meta.masked_phone ||
        meta.from_number_masked ||
        '',
    ).trim()
  }
  if (kind === 'facebook' || kind === 'instagram' || kind === 'x' || kind === 'tiktok') {
    const handle = String(meta.author_handle || meta.customer_label || '').trim()
    return handle ? (handle.startsWith('@') ? handle : `@${handle}`) : ''
  }
  if (kind === 'form') {
    return String(meta.customer_label || meta.sender_email || meta.campaign || 'Form response').trim()
  }
  return String(item?.customer_label || meta.customer_label || '').trim()
}

export function channelMessagePreview(item, { maxLen = 120 } = {}) {
  const kind = channelKind(item)
  let text =
    kind === 'email'
      ? emailBodyWithoutSubject(item)
      : String(item?.message || item?.message_preview || '').trim()
  text = text.replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text
}

export function channelHeaderLabel(kind) {
  switch (kind) {
    case 'email':
      return 'Email'
    case 'whatsapp':
      return 'WhatsApp'
    case 'facebook':
      return 'Facebook'
    case 'instagram':
      return 'Instagram'
    case 'x':
      return 'X'
    case 'tiktok':
      return 'TikTok'
    case 'form':
      return 'Form'
    default:
      return 'Message'
  }
}
