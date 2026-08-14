import {
  channelHeaderLabel,
  channelKind,
  channelMessageSubtitle,
  channelMessageTitle,
  emailBodyWithoutSubject,
} from '../utils/channelMessagePresentation'
import EmailBodyView from './EmailBodyView'

function formatWhen(when) {
  if (!when) return ''
  if (typeof when === 'string' && when.includes(',')) return when
  const t = new Date(when)
  if (!Number.isFinite(t.getTime())) return String(when)
  return t.toLocaleString()
}

function isSentCustomerReply(draft) {
  if (!draft?.sent_at) return false
  const status = String(draft.send_status || '').toLowerCase()
  if (status !== 'sent' && status !== 'queued_internal') return false
  const channel = String(draft.channel || '').toLowerCase()
  const visibility = String(draft.visibility || '').toLowerCase()
  if (channel === 'internal' && visibility === 'private') return false
  return true
}

function buildWhatsAppThread(item, replyDrafts) {
  const bodyText = String(item?.message || item?.message_preview || '').trim()
  const messages = [
    {
      key: `inbound-${item?.id || 'item'}`,
      direction: 'inbound',
      body: bodyText || 'No message',
      when: item?.created_at,
      label: null,
    },
  ]
  for (const draft of replyDrafts || []) {
    if (!isSentCustomerReply(draft)) continue
    messages.push({
      key: `outbound-${draft.id}`,
      direction: 'outbound',
      body: String(draft.body || '').trim() || 'No message',
      when: draft.sent_at || draft.created_at,
      label: draft.created_by_email || 'You',
    })
  }
  messages.sort((a, b) => {
    const ta = new Date(a.when || 0).getTime()
    const tb = new Date(b.when || 0).getTime()
    return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0)
  })
  return messages
}

function WhatsAppBubble({ direction, body, when, label, renderLinkedText }) {
  const renderedBody = renderLinkedText ? renderLinkedText(body) : body
  const isOutbound = direction === 'outbound'
  return (
    <div className={isOutbound ? 'ml-auto max-w-[min(100%,28rem)]' : 'mr-auto max-w-[min(100%,28rem)]'}>
      {isOutbound && label ? (
        <p className="mb-1 text-right text-[10px] font-medium text-gray-500 dark:text-gray-400">{label}</p>
      ) : null}
      <div
        className={
          isOutbound
            ? 'rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-3.5 py-2.5 text-sm leading-relaxed text-gray-900 shadow-sm dark:bg-[#005c4b] dark:text-gray-100'
            : 'rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm leading-relaxed text-gray-900 shadow-sm dark:bg-[#1f2c34] dark:text-gray-100'
        }
      >
        <div className="whitespace-pre-wrap break-words">{renderedBody}</div>
        {when ? (
          <p
            className={`mt-1.5 text-[10px] tabular-nums ${
              isOutbound
                ? 'text-right text-gray-500 dark:text-emerald-100/70'
                : 'text-right text-gray-400 dark:text-gray-500'
            }`}
          >
            {formatWhen(when)}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Renders feedback in a layout that mirrors the originating channel
 * (email header + body, WhatsApp bubble, social post, form card).
 */
export default function ChannelMessageView({ item, renderLinkedText, replyDrafts = [] }) {
  const kind = channelKind(item)
  const meta = item?.channel_metadata && typeof item.channel_metadata === 'object' ? item.channel_metadata : {}
  const title = channelMessageTitle(item)
  const subtitle = channelMessageSubtitle(item)
  const when = meta.email_date || item?.created_at
  const bodyText =
    kind === 'email'
      ? emailBodyWithoutSubject(item) || String(item?.message || item?.message_preview || '').trim()
      : String(item?.message || item?.message_preview || '').trim()
  const body = renderLinkedText ? renderLinkedText(bodyText || 'No message') : bodyText || 'No message'
  const fromEmail = String(meta.sender_email || '').trim()
  const channelLabel = channelHeaderLabel(kind)

  if (kind === 'email') {
    const fromName = String(meta.sender_name || meta.author_handle || '').trim()
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="border-b border-gray-100 bg-[#f8fafc] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400">
          {channelLabel}
        </div>
        <div className="border-b border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">{title}</p>
          <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
            {(fromName || fromEmail) && (
              <p>
                <span className="inline-block w-12 font-semibold text-gray-500 dark:text-gray-400">From</span>
                {fromName ? <span className="font-medium text-gray-900 dark:text-gray-100">{fromName} </span> : null}
                {fromEmail ? (
                  <a
                    href={`mailto:${fromEmail}`}
                    className="font-medium text-[#009750] hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {fromName ? `<${fromEmail}>` : fromEmail}
                  </a>
                ) : null}
              </p>
            )}
            {when ? (
              <p>
                <span className="inline-block w-12 font-semibold text-gray-500 dark:text-gray-400">Date</span>
                <span>{formatWhen(when)}</span>
              </p>
            ) : null}
            <p>
              <span className="inline-block w-12 font-semibold text-gray-500 dark:text-gray-400">To</span>
              <span>Enterprise Life</span>
            </p>
          </div>
        </div>
        <div className="px-4 py-5 sm:px-5">
          <EmailBodyView
            text={bodyText}
            html={meta.email_html || meta.html_body || meta.body_html || ''}
            renderLinkedText={renderLinkedText}
          />
        </div>
        {fromEmail ? (
          <div className="border-t border-gray-100 px-4 py-3 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400 sm:px-5">
            Reply in your mail client to{' '}
            <a
              href={`mailto:${fromEmail}`}
              className="font-semibold text-[#009750] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {fromEmail}
            </a>
          </div>
        ) : null}
      </div>
    )
  }

  if (kind === 'whatsapp') {
    const thread = buildWhatsAppThread(item, replyDrafts)
    return (
      <div className="overflow-hidden rounded-2xl border border-[#25D366]/25 bg-[#ece5dd] p-4 dark:border-emerald-900/40 dark:bg-[#0b141a]">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#075E54] dark:text-emerald-300/80">
          {channelLabel}
          {subtitle ? ` · ${subtitle}` : ''}
        </p>
        <div className="space-y-2">
          {thread.map((msg) => (
            <WhatsAppBubble
              key={msg.key}
              direction={msg.direction}
              body={msg.body}
              when={msg.when}
              label={msg.label}
              renderLinkedText={renderLinkedText}
            />
          ))}
        </div>
      </div>
    )
  }

  if (kind === 'facebook' || kind === 'instagram' || kind === 'x' || kind === 'tiktok') {
    const accent =
      kind === 'facebook'
        ? 'border-[#1877F2]/30'
        : kind === 'instagram'
          ? 'border-pink-300/50'
          : kind === 'tiktok'
            ? 'border-gray-900/20 dark:border-white/20'
            : 'border-gray-300 dark:border-gray-600'
    return (
      <div className={`overflow-hidden rounded-2xl border ${accent} bg-white shadow-sm dark:bg-gray-950`}>
        <div className="flex items-start gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {(subtitle || channelLabel).replace(/^@/, '').slice(0, 1).toUpperCase() || '?'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{subtitle || channelLabel}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {channelLabel}
              {when ? ` · ${formatWhen(when)}` : ''}
            </p>
          </div>
        </div>
        <div className="px-4 py-4 text-sm leading-relaxed text-gray-900 dark:text-gray-100">
          <div className="whitespace-pre-wrap break-words">{body}</div>
        </div>
      </div>
    )
  }

  if (kind === 'form') {
    return (
      <div className="overflow-hidden rounded-2xl border border-orange-200/70 bg-white shadow-sm dark:border-orange-900/40 dark:bg-gray-950">
        <div className="border-b border-orange-100 bg-orange-50/80 px-4 py-3 dark:border-orange-900/30 dark:bg-orange-950/20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-orange-700 dark:text-orange-300">
            {channelLabel} response
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
          {subtitle ? <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{subtitle}</p> : null}
        </div>
        <div className="px-4 py-4 text-sm leading-relaxed text-gray-900 dark:text-gray-100">
          <div className="whitespace-pre-wrap break-words">{body}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
          {channelLabel}
        </p>
        <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      </div>
      <div className="px-4 py-4 text-sm leading-relaxed text-gray-900 dark:text-gray-100">
        <div className="whitespace-pre-wrap break-words">{body}</div>
      </div>
    </div>
  )
}
