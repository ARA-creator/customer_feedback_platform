/**
 * Split plain-text email bodies into message / signature / legal disclaimer
 * so the inbox can render each with appropriate visual weight.
 *
 * Tuned for real Outlook / Exchange exports (name+title+Tel+[cid:…] blocks)
 * that often omit an explicit "Regards," closing.
 */

const CLOSING_RE =
  /^(?:(?:with\s+)?(?:best|kind|warm|many)\s+)?(?:regards|thanks|thank\s+you|cheers|sincerely|cordially|respectfully|yours(?:\s+(?:sincerely|faithfully))?)\b[,!.]?\s*(?:\S.*)?$/i

const SENT_FROM_RE =
  /^sent\s+from\s+(?:my\s+)?(?:iphone|ipad|android|samsung|outlook|yahoo|gmail|blackberry|mobile)\b/i

const GET_OUTLOOK_RE = /^get\s+outlook\s+for\b/i

const DASH_SIG_RE = /^(?:--+|—+|–+)\s*$/

const SEP_LINE_RE = /^(?:[_\-=*]{6,}|\*{3,}|_{3,}|-{3,})\s*$/

const CID_RE = /\[cid:[^\]]+\]/i

const TEL_RE =
  /^(?:tel(?:ephone)?|phone|mobile|cell|fax)\s*(?:#|no\.?|number)?\s*[:.]?\s*/i

const PHONE_LIKE_RE = /(?:\+?\d[\d\s()./\-]{6,}\d)|(?:\(\d{3,}\))/

const TITLE_RE =
  /\b(?:officer|manager|director|executive|analyst|specialist|coordinator|assistant|head\s+of|ceo|cfo|cto|md|claims|underwriting|customer\s+(?:care|service|relations)|qcd)\b/i

const ADDR_RE =
  /\b(?:road|street|avenue|complex|accra|ghana|pmb|gpo|p\.?\s*o\.?\s*box|building|floor|suite)\b/i

const DISCLAIMER_RE =
  /\b(?:confidential|privileged|intended\s+(?:solely|only)\s+for|disclaimer|legal\s+notice|unauthorized|virus|malware|do\s+not\s+(?:copy|forward|distribute)|circulation\s+is\s+prohibited|this\s+(?:e-?mail|message)\s+and\s+any\s+attachments?|please\s+consider\s+the\s+environment|sensitive\s+(?:and\s+)?confidential|error[, ]+please\s+(?:notify|delete)|received\s+this\s+(?:e-?mail|message)\s+in\s+error)\b/i

function normalizeNewlines(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    // Collapse Outlook zero-width / invisible filler lines
    .replace(/[\u200b\u200c\u200d\ufeff\u200e\u200f]/g, '')
    .trim()
}

function isBlank(line) {
  return !String(line || '').trim()
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

function isCidLine(line) {
  return CID_RE.test(String(line || '').trim())
}

function isContactOrSigMeta(line) {
  const t = String(line || '').trim()
  if (!t) return false
  if (isCidLine(t)) return true
  if (TEL_RE.test(t) || (PHONE_LIKE_RE.test(t) && t.length < 80)) return true
  if (/@/.test(t) && t.length < 80) return true
  if (/^https?:\/\//i.test(t) || /^www\./i.test(t)) return true
  if (TITLE_RE.test(t) && t.length < 80) return true
  if (ADDR_RE.test(t) && t.length < 120) return true
  return false
}

function scoreSignatureLine(line) {
  const t = String(line || '').trim()
  if (!t) return 0
  if (isClosingLine(t)) return 4
  if (isCidLine(t)) return 5
  if (TEL_RE.test(t)) return 5
  if (PHONE_LIKE_RE.test(t) && t.length < 80) return 4
  if (TITLE_RE.test(t) && t.length < 80) return 3
  if (ADDR_RE.test(t)) return 3
  if (/@/.test(t) && t.length < 80) return 3
  if (/^https?:\/\//i.test(t)) return 2
  // Short proper-name-ish line near the end
  if (/^[A-Z][\w'.\-]*(?:\s+[A-Z][\w'.\-]*){0,3}$/.test(t) && t.length <= 48) return 2
  return 0
}

/**
 * Find signature start: closing phrase, or a cluster of contact/title/cid/tel lines
 * in the lower part of the message (Outlook signature blocks).
 */
function findSignatureStart(lines) {
  const n = lines.length
  if (n < 2) return -1

  // 1) Explicit closings (prefer later ones).
  let closingIdx = -1
  const minClosing = Math.max(1, Math.floor(n * 0.15))
  for (let i = minClosing; i < n; i += 1) {
    if (!isClosingLine(lines[i])) continue
    closingIdx = i
  }
  if (closingIdx >= 0) return closingIdx

  // 2) Contact / Outlook signature cluster: look for first strong meta line
  //    after a blank (or near end), then walk up past contiguous short name lines.
  const minMeta = Math.max(1, Math.floor(n * 0.2))
  let firstMeta = -1
  for (let i = minMeta; i < n; i += 1) {
    const s = scoreSignatureLine(lines[i])
    if (s >= 3) {
      firstMeta = i
      break
    }
  }
  if (firstMeta < 0) return -1

  // Walk upward through blank lines and short name-like lines to include "Michael" / "Mensah".
  let start = firstMeta
  for (let i = firstMeta - 1; i >= minMeta; i -= 1) {
    const t = String(lines[i] || '').trim()
    if (!t) {
      start = i + 1
      // If previous non-blank looks like a name, keep climbing.
      let j = i - 1
      while (j >= minMeta && isBlank(lines[j])) j -= 1
      if (j < minMeta) break
      const prev = String(lines[j] || '').trim()
      if (scoreSignatureLine(prev) >= 2 || (/^[A-Za-z][\w'.\-]*(?:\s+[A-Za-z][\w'.\-]*){0,3}$/.test(prev) && prev.length <= 48)) {
        start = j
        i = j
        continue
      }
      break
    }
    if (scoreSignatureLine(t) >= 2 || (/^[A-Za-z][\w'.\-]*(?:\s+[A-Za-z][\w'.\-]*){0,3}$/.test(t) && t.length <= 48)) {
      start = i
      continue
    }
    break
  }

  // Require the remaining block to look like a signature (enough meta signal).
  let score = 0
  for (let i = start; i < n; i += 1) score += scoreSignatureLine(lines[i])
  if (score < 5) return -1
  return start
}

function findDisclaimerStart(lines, fromIdx = 0) {
  const n = lines.length
  // Prefer scanning from the bottom so early body words don't false-hit.
  for (let i = n - 1; i >= Math.max(fromIdx, 0); i -= 1) {
    if (!isDisclaimerLine(lines[i])) continue
    // Expand upward through contiguous disclaimer / separator lines.
    let start = i
    while (start > 0) {
      const prev = String(lines[start - 1] || '').trim()
      if (!prev) {
        // Keep a blank only if the line above is also disclaimer-ish.
        const above = start >= 2 ? String(lines[start - 2] || '').trim() : ''
        if (above && (DISCLAIMER_RE.test(above) || SEP_LINE_RE.test(above))) {
          start -= 1
          continue
        }
        break
      }
      if (DISCLAIMER_RE.test(prev) || SEP_LINE_RE.test(prev)) {
        start -= 1
        continue
      }
      break
    }
    // Only treat as disclaimer if it's in the lower portion or clearly a legal block.
    if (start >= Math.floor(n * 0.35) || DISCLAIMER_RE.test(String(lines[i] || ''))) {
      return start
    }
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

/** Remove Outlook cid image placeholders from display text. */
export function scrubEmailDisplayText(text) {
  return normalizeNewlines(text)
    .replace(/\[cid:[^\]]+\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * @returns {{ body: string, signature: string, disclaimer: string }}
 */
export function splitEmailBodyParts(text) {
  const raw = normalizeNewlines(text)
  if (!raw) return { body: '', signature: '', disclaimer: '' }

  const lines = raw.split('\n')
  let sigIdx = findSignatureStart(lines)
  let discIdx = findDisclaimerStart(lines, 0)

  // If disclaimer appears before the detected signature, cut there first.
  if (discIdx >= 0 && (sigIdx < 0 || discIdx < sigIdx)) {
    const body = lines.slice(0, discIdx).join('\n').trim()
    const disclaimer = scrubEmailDisplayText(lines.slice(discIdx).join('\n'))
    const bodyLines = body ? body.split('\n') : []
    const innerSig = findSignatureStart(bodyLines)
    if (innerSig >= 0) {
      return {
        body: scrubEmailDisplayText(bodyLines.slice(0, innerSig).join('\n')),
        signature: scrubEmailDisplayText(bodyLines.slice(innerSig).join('\n')),
        disclaimer,
      }
    }
    return { body: scrubEmailDisplayText(body), signature: '', disclaimer }
  }

  if (sigIdx >= 0) {
    let signatureBlock = lines.slice(sigIdx).join('\n').trim()
    let body = lines.slice(0, sigIdx).join('\n').trim()
    let disclaimer = ''
    const sigLines = signatureBlock.split('\n')
    const dInSig = findDisclaimerStart(sigLines, 0)
    // Disclaimer inside signature only if clearly legal text (not tel/address).
    if (dInSig >= 0 && DISCLAIMER_RE.test(String(sigLines[dInSig] || ''))) {
      disclaimer = scrubEmailDisplayText(sigLines.slice(dInSig).join('\n'))
      signatureBlock = sigLines.slice(0, dInSig).join('\n').trim()
    }
    signatureBlock = signatureBlock.replace(/^(?:--+|—+|–+)\s*\n?/, '').trim()
    return {
      body: scrubEmailDisplayText(body),
      signature: scrubEmailDisplayText(signatureBlock),
      disclaimer,
    }
  }

  if (discIdx >= 0) {
    return {
      body: scrubEmailDisplayText(lines.slice(0, discIdx).join('\n')),
      signature: '',
      disclaimer: scrubEmailDisplayText(lines.slice(discIdx).join('\n')),
    }
  }

  return { body: scrubEmailDisplayText(raw), signature: '', disclaimer: '' }
}
