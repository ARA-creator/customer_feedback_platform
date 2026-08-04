import { useMemo, useState } from 'react'
import { emailParagraphs, splitEmailBodyParts } from '../utils/emailBodyParts'
import { looksLikeEmailHtml, sanitizeEmailHtml } from '../utils/sanitizeEmailHtml'

function LinkedBlock({ text, renderLinkedText, className = '' }) {
  const content = renderLinkedText ? renderLinkedText(text) : text
  return <div className={className}>{content}</div>
}

const SOCIAL_LABEL_RE = /^\[?\s*(facebook|linkedin|twitter|x|youtube|instagram|tiktok)\s*\]?\s*$/i
const SOCIAL_INLINE_RE =
  /^\[?\s*(facebook|linkedin|twitter|x|youtube|instagram|tiktok)\s*\]?\s*[:.]?\s*(https?:\/\/\S+|www\.\S+)\s*$/i
const CONTACT_LABEL_RE =
  /^(tel(?:ephone)?(?:\s*#)?|phone(?:\s*\/\s*fax)?|mobile|fax|email|e-?mail|web(?:site)?|www)\s*[:.#]?\s*(.*)$/i

function normalizeSocialLabel(raw) {
  const k = String(raw || '').toLowerCase()
  if (k === 'x') return 'X'
  return k.charAt(0).toUpperCase() + k.slice(1)
}

/**
 * Turn Outlook plain-text signature lines into a structured HTML-like block.
 */
function SignatureLines({ text, renderLinkedText }) {
  const rows = useMemo(() => {
    const lines = String(text || '')
      .split('\n')
      .map((l) => l.trimEnd())
    const out = []
    for (let i = 0; i < lines.length; i += 1) {
      const raw = lines[i]
      const t = raw.trim()
      if (!t) {
        out.push({ type: 'gap' })
        continue
      }
      if (/\[cid:[^\]]+\]/i.test(t)) continue

      const inlineSocial = t.match(SOCIAL_INLINE_RE)
      if (inlineSocial) {
        const url = inlineSocial[2].startsWith('http') ? inlineSocial[2] : `https://${inlineSocial[2]}`
        out.push({ type: 'social', label: normalizeSocialLabel(inlineSocial[1]), url })
        continue
      }

      if (SOCIAL_LABEL_RE.test(t)) {
        const next = String(lines[i + 1] || '').trim()
        if (/^https?:\/\//i.test(next) || /^www\./i.test(next)) {
          const url = next.startsWith('http') ? next : `https://${next}`
          out.push({ type: 'social', label: normalizeSocialLabel(t.replace(/[\[\]]/g, '')), url })
          i += 1
          continue
        }
      }

      const contact = t.match(CONTACT_LABEL_RE)
      if (contact) {
        out.push({
          type: 'contact',
          label: contact[1].replace(/#/g, '').trim(),
          value: (contact[2] || '').trim() || t,
        })
        continue
      }

      if (/^https?:\/\//i.test(t) || /^www\./i.test(t)) {
        const url = t.startsWith('http') ? t : `https://${t}`
        out.push({ type: 'link', url, label: t })
        continue
      }

      out.push({ type: 'text', text: t })
    }

    // Promote first 1–3 short text lines as identity (name / title).
    let identityBudget = 3
    return out.map((row) => {
      if (row.type !== 'text' || identityBudget <= 0) return row
      if (row.text.length > 56) return row
      if (/^(?:regards|thanks|thank you|cheers|sincerely)\b/i.test(row.text)) return row
      identityBudget -= 1
      const isTitle =
        /\b(?:officer|manager|director|executive|analyst|specialist|qcd|claims|life)\b/i.test(row.text) ||
        row.text === row.text.toUpperCase()
      return { ...row, type: isTitle ? 'title' : 'name' }
    })
  }, [text])

  if (!rows.length) return null

  const socials = rows.filter((r) => r.type === 'social')
  const rest = rows.filter((r) => r.type !== 'social')

  return (
    <div className="space-y-1.5">
      {rest.map((row, i) => {
        if (row.type === 'gap') return <div key={`g-${i}`} className="h-1.5" aria-hidden />
        if (row.type === 'name') {
          return (
            <p key={`n-${i}`} className="text-[14px] font-semibold tracking-tight text-[#0b3b1f] dark:text-emerald-200">
              {row.text}
            </p>
          )
        }
        if (row.type === 'title') {
          return (
            <p key={`t-${i}`} className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#007a42] dark:text-emerald-300/90">
              {row.text}
            </p>
          )
        }
        if (row.type === 'contact') {
          return (
            <p key={`c-${i}`} className="text-[12px] text-gray-600 dark:text-gray-300">
              <span className="font-semibold text-gray-500 dark:text-gray-400">{row.label}: </span>
              <LinkedBlock
                text={row.value}
                renderLinkedText={renderLinkedText}
                className="inline break-words"
              />
            </p>
          )
        }
        if (row.type === 'link') {
          return (
            <p key={`l-${i}`} className="text-[12px]">
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#009750] hover:underline break-all"
                onClick={(e) => e.stopPropagation()}
              >
                {row.label}
              </a>
            </p>
          )
        }
        return (
          <LinkedBlock
            key={`x-${i}`}
            text={row.text}
            renderLinkedText={renderLinkedText}
            className="text-[12.5px] text-gray-600 dark:text-gray-300 break-words"
          />
        )
      })}

      {socials.length ? (
        <div className="flex flex-wrap gap-2 pt-2">
          {socials.map((s, i) => (
            <a
              key={`s-${i}-${s.label}`}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-[#009750]/25 bg-[#009750]/10 px-2.5 py-1 text-[11px] font-semibold text-[#007a42] hover:bg-[#009750]/15 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              onClick={(e) => e.stopPropagation()}
            >
              {s.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function EmailHtmlFrame({ html }) {
  const safe = useMemo(() => sanitizeEmailHtml(html), [html])
  if (!safe) return null
  return (
    <div
      className="email-html-body max-w-none overflow-x-auto rounded-xl border border-gray-200/90 bg-white p-4 text-[13px] leading-relaxed text-gray-800 shadow-sm dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 [&_a]:font-medium [&_a]:text-[#009750] [&_a]:underline-offset-2 hover:[&_a]:underline [&_img]:my-2 [&_img]:max-w-full [&_img]:h-auto [&_table]:max-w-full [&_p]:my-1.5"
      // Sanitized allowlist HTML from Outlook signatures / email bodies.
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  )
}

/**
 * Polished email body: HTML signature when available, else structured plain-text parts.
 */
export default function EmailBodyView({ text, html, renderLinkedText }) {
  const [disclaimerOpen, setDisclaimerOpen] = useState(false)
  const htmlSource = String(html || '').trim() || (looksLikeEmailHtml(text) ? String(text || '') : '')
  const parts = useMemo(() => splitEmailBodyParts(text), [text])
  const paragraphs = useMemo(() => emailParagraphs(parts.body), [parts.body])

  if (htmlSource) {
    return (
      <div className="space-y-3">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-4 w-0.5 rounded-full bg-[#009750]" aria-hidden />
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#009750] dark:text-emerald-300/90">
            Email
          </p>
        </div>
        <EmailHtmlFrame html={htmlSource} />
      </div>
    )
  }

  if (!String(text || '').trim()) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No message</p>
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3.5 text-[15px] leading-[1.65] text-gray-900 dark:text-gray-100">
        {paragraphs.length ? (
          paragraphs.map((p, i) => (
            <LinkedBlock
              key={`p-${i}`}
              text={p}
              renderLinkedText={renderLinkedText}
              className="whitespace-pre-wrap break-words"
            />
          ))
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No message</p>
        )}
      </div>

      {parts.signature ? (
        <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
          <div className="rounded-xl border border-[#009750]/15 bg-gradient-to-br from-[#eaf7f0]/70 via-white to-white px-4 py-3 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-gray-950 dark:to-gray-950">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-4 w-0.5 rounded-full bg-[#009750]" aria-hidden />
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#009750] dark:text-emerald-300/90">
                Signature
              </p>
            </div>
            <SignatureLines text={parts.signature} renderLinkedText={renderLinkedText} />
          </div>
        </div>
      ) : null}

      {parts.disclaimer ? (
        <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setDisclaimerOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            aria-expanded={disclaimerOpen}
          >
            <span aria-hidden>{disclaimerOpen ? '▾' : '▸'}</span>
            {disclaimerOpen ? 'Hide legal notice' : 'Show legal notice / disclaimer'}
          </button>
          {disclaimerOpen ? (
            <div className="mt-2 rounded-lg border border-gray-200/80 bg-gray-50 px-3 py-2.5 text-[11px] leading-relaxed text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
              <LinkedBlock
                text={parts.disclaimer}
                renderLinkedText={renderLinkedText}
                className="whitespace-pre-wrap break-words"
              />
            </div>
          ) : (
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
              {parts.disclaimer.replace(/\s+/g, ' ').trim()}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
