import { useMemo, useState } from 'react'
import { emailParagraphs, splitEmailBodyParts } from '../utils/emailBodyParts'

function LinkedBlock({ text, renderLinkedText, className = '' }) {
  const content = renderLinkedText ? renderLinkedText(text) : text
  return <div className={className}>{content}</div>
}

function SignatureLines({ text, renderLinkedText }) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l, idx, arr) => l.trim() || (idx > 0 && idx < arr.length - 1))

  if (!lines.length) return null

  // First non-empty line after a closing gets name weight when it looks like a person/company.
  let nameIdx = -1
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].trim()
    if (!t) continue
    if (/^(?:(?:with\s+)?(?:best|kind|warm|many)\s+)?(?:regards|thanks|thank\s+you|cheers|sincerely|cordially|respectfully|yours)\b/i.test(t)) {
      continue
    }
    if (/^sent\s+from\b/i.test(t) || /^get\s+outlook\b/i.test(t)) continue
    nameIdx = i
    break
  }

  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const t = line.trim()
        if (!t) return <div key={`sp-${i}`} className="h-1.5" aria-hidden />
        const isName = i === nameIdx
        const isClosing =
          /^(?:(?:with\s+)?(?:best|kind|warm|many)\s+)?(?:regards|thanks|thank\s+you|cheers|sincerely|cordially|respectfully|yours)\b/i.test(
            t,
          )
        const isMeta =
          /@/.test(t) ||
          /\+?\d[\d\s().-]{6,}\d/.test(t) ||
          /^(tel|phone|mobile|email|web|www\.)\b/i.test(t) ||
          /^https?:\/\//i.test(t)
        return (
          <LinkedBlock
            key={`${i}-${t.slice(0, 24)}`}
            text={t}
            renderLinkedText={renderLinkedText}
            className={
              isName
                ? 'text-[13px] font-semibold tracking-tight text-[#0b3b1f] dark:text-emerald-200'
                : isClosing
                  ? 'text-[13px] italic text-gray-600 dark:text-gray-300'
                  : isMeta
                    ? 'text-[12px] text-gray-500 dark:text-gray-400'
                    : 'text-[12.5px] text-gray-600 dark:text-gray-300'
            }
          />
        )
      })}
    </div>
  )
}

/**
 * Polished email body: message paragraphs, styled signature, muted legal footer.
 */
export default function EmailBodyView({ text, renderLinkedText }) {
  const [disclaimerOpen, setDisclaimerOpen] = useState(false)
  const parts = useMemo(() => splitEmailBodyParts(text), [text])
  const paragraphs = useMemo(() => emailParagraphs(parts.body), [parts.body])

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
