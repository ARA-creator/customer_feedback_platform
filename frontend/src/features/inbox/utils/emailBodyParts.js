/**
 * Split plain-text email bodies into message / signature / legal disclaimer
 * so the inbox can render each with appropriate visual weight.
 */

const CLOSING_RE =
  /^(?:(?:with\s+)?(?:best|kind|warm|many)\s+)?(?:regards|thanks|thank\s+you|cheers|sincerely|cordially|respectfully|yours(?:\s+(?:sincerely|faithfully))?)\b[,!.]?\s*$/i

const SENT_FROM_RE =
  /^sent\s+from\s+(?:my\s+)?(?:iphone|ipad|android|samsung|outlook|yahoo|gmail|blackberry|mobile)\b/i

const GET_OUTLOOK_RE = /^get\s+outlook\s+for\b/i

const DASH_SIG_RE = /^(?:--+|—+|–+)\s*$/

const SEP_LINE_RE = /^(?:[_\-=*]{6,}|\*{3,}|_{3,}|-{3,})\s*$/

const DISCLAIMER_RE =
  /\b(?:confidential|privileged|intended\s+(?:solely|only)\s+for|disclaimer|legal\s+notice|unauthorized|virus|malware|do\s+not\s+(?:copy|forward|distribute)|circulation\s+is\s+prohibited|this\s+(?:e-?mail|message)\s+and\s+any\s+attachments?|please\s+consider\s+the\s+environment|sensitive\s+(?:and\s+)?confidential)\b/i

function normalizeNewlines(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim()
}

function isClosingLine(line) {
  const t = String(line || '').trim()
  if (!t) return false
  if (DASH_SIG_RE.test(t)) return true
  if (CLOSING_RE.test(t)) return true
  if (SENT_FROM_RE.test(t)) return true
  if (GET_OUTLOOK_RE.test(t)) return true
  return false
}

function isDisclaimerLine(line) {
  const t = String(line || '').trim()
  if (!t) return false
  if (SEP_LINE_RE.test(t)) return true
  return DISCLAIMER_RE.test(t)
}

/**
 * Find the best signature start index among lines.
 * Prefer closings in the lower half of the message to avoid false hits in the body.
 */
function findSignatureStart(lines) {
  const n = lines.length
  if (n < 2) return -1
  const minIdx = Math.max(1, Math.floor(n * 0.25))
  let best = -1
  for (let i = minIdx; i < n; i += 1) {
    if (!isClosingLine(lines[i])) continue
    // Prefer a closing that sits after a blank line, or is a dash separator.
    const prevBlank = i > 0 && !String(lines[i - 1] || '').trim()
    const isDash = DASH_SIG_RE.test(String(lines[i] || '').trim())
    if (prevBlank || isDash || i >= Math.floor(n * 0.45)) {
      best = i
      // Keep scanning so later closings win (quote trails / stacked thanks).
    }
  }
  return best
}

function findDisclaimerStart(lines, fromIdx = 0) {
  const n = lines.length
  for (let i = Math.max(fromIdx, 0); i < n; i += 1) {
    if (isDisclaimerLine(lines[i])) return i
  }
  return -1
}

/** Collapse runs of blank lines and return paragraph strings. */
export function emailParagraphs(text) {
  const raw = normalizeNewlines(text)
  if (!raw) return []
  return raw
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]+\n/g, '\n').trim())
    .filter(Boolean)
}

/**
 * @returns {{ body: string, signature: string, disclaimer: string }}
 */
export function splitEmailBodyParts(text) {
  const raw = normalizeNewlines(text)
  if (!raw) return { body: '', signature: '', disclaimer: '' }

  const lines = raw.split('\n')
  let sigIdx = findSignatureStart(lines)
  let discIdx = findDisclaimerStart(lines, sigIdx >= 0 ? sigIdx : Math.floor(lines.length * 0.4))

  // If disclaimer appears before the detected signature, treat that as the cut.
  if (discIdx >= 0 && (sigIdx < 0 || discIdx < sigIdx)) {
    // Separator-only line directly above a disclaimer should stay with disclaimer.
    if (discIdx > 0 && SEP_LINE_RE.test(String(lines[discIdx] || '').trim())) {
      // keep
    }
    const body = lines.slice(0, discIdx).join('\n').trim()
    const disclaimer = lines.slice(discIdx).join('\n').trim()
    // Still try to peel a signature from the body tip.
    const bodyLines = body ? body.split('\n') : []
    const innerSig = findSignatureStart(bodyLines)
    if (innerSig >= 0) {
      return {
        body: bodyLines.slice(0, innerSig).join('\n').trim(),
        signature: bodyLines.slice(innerSig).join('\n').trim(),
        disclaimer,
      }
    }
    return { body, signature: '', disclaimer }
  }

  if (sigIdx >= 0) {
    let signatureBlock = lines.slice(sigIdx).join('\n').trim()
    let body = lines.slice(0, sigIdx).join('\n').trim()
    let disclaimer = ''
    const sigLines = signatureBlock.split('\n')
    const dInSig = findDisclaimerStart(sigLines, 1)
    if (dInSig >= 0) {
      disclaimer = sigLines.slice(dInSig).join('\n').trim()
      signatureBlock = sigLines.slice(0, dInSig).join('\n').trim()
    }
    // Drop a lone "--" dash line from the signature display start.
    signatureBlock = signatureBlock.replace(/^(?:--+|—+|–+)\s*\n?/, '').trim()
    return { body, signature: signatureBlock, disclaimer }
  }

  if (discIdx >= 0) {
    return {
      body: lines.slice(0, discIdx).join('\n').trim(),
      signature: '',
      disclaimer: lines.slice(discIdx).join('\n').trim(),
    }
  }

  return { body: raw, signature: '', disclaimer: '' }
}
