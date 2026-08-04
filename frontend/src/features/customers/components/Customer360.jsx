import { useEffect, useMemo, useState } from 'react'
import { FiAlertCircle, FiMail, FiRefreshCw, FiUser, FiX } from 'react-icons/fi'
import { getCustomerProfile } from '../services/customers.api'
import { Customer360Skeleton, PageIntro } from '../../../shared/components/ui'
import { SourcePill } from '../../dashboard/components/SourceIndicators'

function fmtRelative(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const sec = Math.round((Date.now() - t) / 1000)
  if (sec < 45) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 14) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function SentimentPill({ label }) {
  const s = String(label || '').toLowerCase()
  const cls =
    s === 'positive'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900/40'
      : s === 'negative'
        ? 'bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/30 dark:text-rose-200 dark:border-rose-900/40'
        : 'bg-gray-50 text-gray-900 border-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700'
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      {(label || 'unknown').toString().replace(/_/g, ' ')}
    </span>
  )
}

function safeArr(x) {
  return Array.isArray(x) ? x : []
}

/** Ghana +233 / 233 / 0… / bare national → canonical +233… */
function canonicalizeGhanaPhone(raw) {
  let s = String(raw || '').trim()
  if (!s || s.startsWith('*')) return null
  const lower = s.toLowerCase()
  for (const prefix of ['whatsapp:', 'phone:', 'wa:']) {
    if (lower.startsWith(prefix)) {
      s = s.slice(prefix.length).trim()
      break
    }
  }
  const digits = s.replace(/\D/g, '')
  if (digits.length < 7) return null
  if (digits.startsWith('233') && digits.length === 12) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 10) return `+233${digits.slice(1)}`
  if (digits.length === 9 && '234567'.includes(digits[0])) return `+233${digits}`
  return `+${digits}`
}

/** Prefer local 0XXXXXXXXX for Ghana numbers in Customer Identity. */
function formatGhanaPhoneDisplay(raw) {
  const canon = canonicalizeGhanaPhone(raw)
  if (!canon) return null
  const digits = canon.replace(/\D/g, '')
  if (digits.startsWith('233') && digits.length === 12) return `0${digits.slice(3)}`
  return canon
}

/** One chip per distinct phone (always 0… for Ghana) + distinct emails; never name handles. */
function dedupeIdentityChips(idents) {
  const out = []
  const seenPhones = new Set()
  const seenEmails = new Set()
  const seenOther = new Set()

  const isPersonName = (value) => {
    const s = String(value || '').trim().replace(/^"|"$/g, '')
    if (!s || s.includes('@')) return false
    return s.includes(' ') && !/\d/.test(s)
  }

  for (const ident of safeArr(idents)) {
    let t = String(ident?.identifier_type || '').toLowerCase().replace(/\s+/g, '_')
    if (t === 'policy' || t === 'policy_hash' || String(ident?.identifier_value || '').startsWith('policy_hash:')) {
      continue
    }
    // Never show name-as-handle / thread / message ids.
    if (t === 'handle' || t === 'thread' || t === 'msg' || t === 'message_sid') {
      continue
    }

    let label = String(ident?.label || ident?.identifier_value || '').trim().replace(/^"|"$/g, '')
    if (!label) continue
    if (isPersonName(label)) continue

    // Phone variants (+233 / 233 / 0…) → one chip starting with 0.
    if (t === 'phone' || t === 'wa' || t === 'whatsapp') {
      const phoneCanon = canonicalizeGhanaPhone(label) || canonicalizeGhanaPhone(ident?.identifier_value)
      if (!phoneCanon || seenPhones.has(phoneCanon)) continue
      seenPhones.add(phoneCanon)
      out.push({
        ...ident,
        identifier_type: 'phone',
        label: formatGhanaPhoneDisplay(phoneCanon) || phoneCanon,
        identifier_value: `phone:${phoneCanon}`,
      })
      continue
    }

    if (t === 'email' || t === 'email_hash' || label.includes('@')) {
      const email = label.includes('@') ? label : String(ident?.identifier_value || '')
      const key = email.trim().toLowerCase()
      if (!key.includes('@') || seenEmails.has(key)) continue
      seenEmails.add(key)
      out.push({
        ...ident,
        identifier_type: 'email',
        label: email.trim().replace(/^"|"$/g, ''),
      })
      continue
    }

    const key = `${t}:${label.toLowerCase()}`
    if (seenOther.has(key)) continue
    seenOther.add(key)
    out.push({ ...ident, label })
  }

  const order = { email: 0, phone: 1 }
  out.sort((a, b) => {
    const ta = String(a.identifier_type || '').toLowerCase()
    const tb = String(b.identifier_type || '').toLowerCase()
    const da = order[ta] ?? 9
    const db = order[tb] ?? 9
    if (da !== db) return da - db
    return String(a.label || '').localeCompare(String(b.label || ''), undefined, { sensitivity: 'base' })
  })
  return out
}

function extractUrls(text) {
  const s = String(text || '')
  const re = /(https?:\/\/[^\s<>)"']+|www\.[^\s<>)"']+)/gi
  const out = []
  let m
  while ((m = re.exec(s))) {
    const raw = m[0].replace(/[.,;:]+$/g, '')
    const url = raw.startsWith('http') ? raw : `https://${raw}`
    if (!out.includes(url)) out.push(url)
  }
  return out
}

/** PREFIX + 6–8 digits → canonical PREFIX+7digits when short. */
function canonicalizePolicyNumber(raw) {
  const n = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\s\-_\/]+/g, '')
  const m = n.match(/^([A-Z0-9]{4})(\d{6,8})$/)
  if (!m) return null
  const prefix = m[1]
  let digits = m[2]
  if (digits.length === 6) digits = digits.padStart(7, '0')
  return `${prefix}${digits}`
}

function findPolicyHashForNumber(rawNumber, matches) {
  const canon = canonicalizePolicyNumber(rawNumber)
  if (!canon) return null
  for (const m of safeArr(matches)) {
    const n = canonicalizePolicyNumber(m?.policy_number || m?.policy_masked)
    if (n && n === canon && m.policy_hash) return m.policy_hash
  }
  return null
}

function renderLinkedText(text, { onPolicyClick, policyMatches } = {}) {
  const s = String(text || '')
  // URLs or policy numbers like BA2V0007327 / EB2V0000024
  const re = /(https?:\/\/[^\s<>)"']+|www\.[^\s<>)"']+|\b[A-Za-z0-9]{4}\d{6,8}\b)/gi
  const parts = []
  let last = 0
  let m
  let linkIdx = 0
  while ((m = re.exec(s))) {
    const start = m.index
    let raw = m[0]
    const trailing = raw.match(/[.,;:]+$/)?.[0] || ''
    if (trailing) raw = raw.slice(0, -trailing.length)
    if (start > last) parts.push(s.slice(last, start))

    const isUrl = /^https?:\/\//i.test(raw) || /^www\./i.test(raw)
    if (isUrl) {
      const url = raw.startsWith('http') ? raw : `https://${raw}`
      parts.push(
        <a
          key={`link-${linkIdx}-${start}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-[#009750] hover:underline break-words"
          onClick={(e) => e.stopPropagation()}
        >
          {raw}
        </a>,
      )
    } else {
      const policyHash = findPolicyHashForNumber(raw, policyMatches)
      if (policyHash && typeof onPolicyClick === 'function') {
        parts.push(
          <button
            key={`pol-${linkIdx}-${start}`}
            type="button"
            className="font-semibold text-[#009750] underline decoration-[#009750]/40 underline-offset-2 hover:decoration-[#009750] break-words"
            title="Filter history to this policy"
            onClick={(e) => {
              e.stopPropagation()
              onPolicyClick(policyHash)
            }}
          >
            {canonicalizePolicyNumber(raw) || raw.toUpperCase()}
          </button>,
        )
      } else {
        parts.push(raw)
      }
    }
    linkIdx += 1
    last = start + m[0].length - trailing.length
  }
  if (last < s.length) parts.push(s.slice(last))
  return parts.length ? parts : s
}

export default function Customer360({ onNavigate }) {
  const [customerKey, setCustomerKey] = useState(() => {
    try {
      return sessionStorage.getItem('cfp_customer_key') || ''
    } catch {
      return ''
    }
  })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [openItem, setOpenItem] = useState(null)
  const [policyFilterHash, setPolicyFilterHash] = useState('')

  const history = useMemo(() => safeArr(data?.history), [data])
  const visibleHistory = useMemo(() => {
    const h = safeArr(history)
    const f = String(policyFilterHash || '').trim()
    if (!f) return h
    return h.filter((it) => safeArr(it?.policy_matches).some((m) => m && m.policy_hash === f))
  }, [history, policyFilterHash])

  const policySummary = useMemo(() => {
    const map = new Map()
    const normalizePolicyKey = (m) => {
      const number = String(m?.policy_number || m?.policy_masked || '')
        .trim()
        .toUpperCase()
        .replace(/[\s\-_\/]+/g, '')
      if (!number) return m?.policy_hash || ''
      if (number.includes('(NAME MATCH)')) {
        return `name:${String(m?.product_prefix || number).toUpperCase()}`
      }
      // PREFIX + 6 digits → treat as zero-padded 7-digit policy (EB2V000024 == EB2V0000024)
      const match = number.match(/^([A-Z0-9]{4})(\d{6,8})$/)
      if (match) {
        const prefix = match[1]
        let digits = match[2]
        if (digits.length === 6) digits = digits.padStart(7, '0')
        return `num:${prefix}${digits}`
      }
      return m?.policy_hash || number
    }
    for (const it of safeArr(history)) {
      for (const m of safeArr(it?.policy_matches)) {
        if (!m || !m.policy_hash) continue
        const key = normalizePolicyKey(m)
        if (!key) continue
        if (!map.has(key)) {
          const number = String(m.policy_number || m.policy_masked || '').trim()
          const padded = (() => {
            const n = number.toUpperCase().replace(/[\s\-_\/]+/g, '')
            const mm = n.match(/^([A-Z0-9]{4})(\d{6,8})$/)
            if (!mm) return m.policy_number || m.policy_masked || null
            const prefix = mm[1]
            let digits = mm[2]
            if (digits.length === 6) digits = digits.padStart(7, '0')
            return `${prefix}${digits}`
          })()
          map.set(key, {
            policy_hash: m.policy_hash,
            policy_masked: padded || m.policy_masked,
            policy_number: padded || m.policy_number || null,
            product_prefix: m.product_prefix,
            product_group: m.product_group,
            needs_review: !!m.needs_review,
            total_mentions: 0,
          })
        }
        const row = map.get(key)
        row.total_mentions += 1
        row.needs_review = row.needs_review || !!m.needs_review
        row.product_group = row.product_group || m.product_group
        row.product_prefix = row.product_prefix || m.product_prefix
        // Prefer longer/canonical number when merging duplicates.
        const cand = m.policy_number || m.policy_masked
        if (cand && String(cand).replace(/\D/g, '').length >= String(row.policy_number || '').replace(/\D/g, '').length) {
          const n = String(cand).toUpperCase().replace(/[\s\-_\/]+/g, '')
          const mm = n.match(/^([A-Z0-9]{4})(\d{6,8})$/)
          if (mm) {
            const prefix = mm[1]
            let digits = mm[2]
            if (digits.length === 6) digits = digits.padStart(7, '0')
            row.policy_number = `${prefix}${digits}`
            row.policy_masked = row.policy_number
          }
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.total_mentions || 0) - (a.total_mentions || 0))
  }, [history])

  const distinctPolicyCount = useMemo(() => {
    return policySummary.filter((p) => {
      const n = String(p?.policy_number || p?.policy_masked || '')
        .trim()
        .toUpperCase()
      return n && !n.includes('(NAME MATCH)')
    }).length
  }, [policySummary])

  const load = async () => {
    const key = String(customerKey || '').trim()
    if (!key) {
      setLoading(false)
      setData(null)
      setError('No customer selected.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await getCustomerProfile(key)
      setData(res)
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load customer')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerKey])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#009750]/10 text-[#009750] dark:bg-emerald-500/10 dark:text-emerald-300">
              <FiUser className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <PageIntro
                title={(() => {
                  const label = data?.customer?.label || 'Customer 360'
                  const phoneDisplay = formatGhanaPhoneDisplay(label)
                  const canon = canonicalizeGhanaPhone(label)
                  if (phoneDisplay && canon) {
                    return (
                      <a href={`tel:${canon}`} className="hover:text-[#009750] hover:underline">
                        {phoneDisplay}
                      </a>
                    )
                  }
                  return label
                })()}
              />
              {data?.customer?.policy_holder_status === 'verified' || distinctPolicyCount > 0 ? (
                <button
                  type="button"
                  className="mt-2 text-left text-xs font-semibold text-emerald-800 underline decoration-emerald-700/30 underline-offset-2 hover:decoration-emerald-800 dark:text-emerald-200 dark:decoration-emerald-200/40"
                  title="View linked policies"
                  onClick={() => {
                    document.getElementById('cfp-customer-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  Policyholder ·{' '}
                  {distinctPolicyCount ||
                    data.customer.verified_policy_count ||
                    data.customer.linked_policy_count ||
                    1}{' '}
                  linked{' '}
                  {(distinctPolicyCount || data.customer.verified_policy_count || data.customer.linked_policy_count || 1) === 1
                    ? 'policy'
                    : 'policies'}{' '}
                  detected from policy numbers
                </button>
              ) : data?.customer?.policy_holder_status === 'estimated' ? (
                <p className="mt-2 text-xs font-semibold text-amber-900 dark:text-amber-100">
                  Possible policyholder · product inferred from feedback (no policy number confirmed yet)
                </p>
              ) : null}
            </div>
          </div>

          {data?.customer?.email ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#009750]/10 text-[#009750] dark:bg-emerald-500/10 dark:text-emerald-300">
                <FiMail className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Email</p>
                <a
                  href={`mailto:${data.customer.email}`}
                  className="text-sm font-medium text-[#009750] hover:underline break-all"
                >
                  {data.customer.email}
                </a>
              </div>
            </div>
          ) : customerKey ? (
            <p className="pl-14 text-xs text-gray-500 dark:text-gray-400 break-all">
              {customerKey.replace(/^email_hash:/, 'Customer key: ')}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          {loading && <Customer360Skeleton />}
          {!loading && error && (
            <div
              className="card p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-rose-200 bg-rose-50/80 dark:border-rose-900/40 dark:bg-rose-950/20"
              role="alert"
            >
              <div className="flex gap-3 text-sm text-rose-900 dark:text-rose-100">
                <FiAlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="font-semibold">Couldn’t load this profile</p>
                  <p className="mt-1 text-rose-800/90 dark:text-rose-200/90">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => load()}
                className="inline-flex shrink-0 min-h-[44px] items-center justify-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
              >
                <FiRefreshCw className="h-4 w-4" aria-hidden />
                Retry
              </button>
            </div>
          )}

          {!loading && !error && (
            <div className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Feedback history</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Last touch: <span className="font-semibold">{fmtRelative(data?.customer?.last_seen_at)}</span>
                </p>
              </div>

              {visibleHistory.length === 0 ? (
                <div
                  className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center dark:border-gray-700 dark:bg-gray-900/40"
                  role="status"
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">No feedback in this view</p>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {policyFilterHash
                      ? 'Nothing matches the selected policy filter. Clear the filter or pick another product chip.'
                      : 'When connected channels receive feedback for this customer, it appears here with sentiment.'}
                  </p>
                  {policyFilterHash ? (
                    <button
                      type="button"
                      onClick={() => setPolicyFilterHash('')}
                      className="mt-4 inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#009750] px-4 py-2 text-sm font-semibold text-white hover:bg-[#007a42] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
                    >
                      Clear policy filter
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {visibleHistory.map((it) => (
                    <div
                      key={it.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenItem(it)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setOpenItem(it)
                        }
                      }}
                      className="w-full cursor-pointer rounded-xl border border-gray-200 bg-white p-3 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750]/40 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <SentimentPill label={it.sentiment_label} />
                          <SourcePill
                            source={it.source_group || it.source}
                            label={
                              it.channel_label ||
                              it.channel_metadata?.channel_label ||
                              it.channel_metadata?.mailbox_label ||
                              undefined
                            }
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{fmtRelative(it.created_at)}</span>
                      </div>
                      <p className="mt-2 text-sm text-gray-800 dark:text-gray-200 line-clamp-2 whitespace-pre-wrap">
                        {renderLinkedText(it.message_preview || it.message || '', {
                          policyMatches: [...safeArr(it.policy_matches), ...policySummary],
                          onPolicyClick: (hash) => {
                            setPolicyFilterHash(hash)
                            document.getElementById('cfp-customer-products')?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'nearest',
                            })
                          },
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {!loading && !error && data?.customer && (
            <>
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Overview</h2>
                <div className="mt-3">
                  <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Total feedback</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{data.customer.total_feedback ?? history.length}</p>
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sentiment</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(data.customer.sentiment_counts || {}).map(([k, v]) => (
                    <span
                      key={k}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
                    >
                      <span className="capitalize">{k}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] dark:bg-gray-800">{v}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="card p-5">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Customer Identity</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(() => {
                    const idents = dedupeIdentityChips(data.identifiers)
                    if (idents.length === 0) {
                      return <p className="text-sm text-gray-600 dark:text-gray-300">No customer identity yet.</p>
                    }
                    return idents.slice(0, 24).map((ident, idx) => {
                      const typeLabel = (ident.identifier_type || 'id').toString().replace(/_/g, ' ')
                      const value = ident.label || ident.identifier_value
                      return (
                        <span
                          key={ident.id ?? `${ident.identifier_type}-${ident.label}-${idx}`}
                          className="inline-flex items-center rounded-full border border-[#009750]/30 bg-[#009750]/10 px-3 py-1.5 text-xs font-semibold text-[#007a42] dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                          title={value}
                        >
                          {typeLabel}: {value}
                        </span>
                      )
                    })
                  })()}
                </div>
              </div>

              <div id="cfp-customer-products" className="card p-5 scroll-mt-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">My Policies</h2>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-md">
                      Click a chip to filter history. “Review” means the match needs staff confirmation.
                    </p>
                  </div>
                  {policyFilterHash ? (
                    <button
                      type="button"
                      onClick={() => setPolicyFilterHash('')}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/50 shrink-0"
                      title="Clear policy filter"
                    >
                      Filtered · {policyFilterHash.slice(0, 10)}… ×
                    </button>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {policySummary.length === 0 ? (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      No linked policies yet—when feedback mentions a plan name or policy reference, chips appear here.
                    </p>
                  ) : (
                    policySummary.slice(0, 18).map((p) => {
                      const isActive = policyFilterHash && p.policy_hash === policyFilterHash
                      const labelLeft = p.product_group || p.product_prefix || 'product'
                      const labelRight = p.policy_number || p.policy_masked || 'policy'
                      return (
                        <button
                          key={p.policy_hash}
                          type="button"
                          onClick={() => setPolicyFilterHash((prev) => (prev === p.policy_hash ? '' : p.policy_hash))}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                            isActive
                              ? 'border-[#009750] bg-[#009750]/20 text-[#007a42] dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100'
                              : 'border-[#009750]/30 bg-[#009750]/10 text-[#007a42] hover:bg-[#009750]/15 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60'
                          }`}
                          title={p.policy_hash}
                        >
                          <span>{labelLeft}</span>
                          <span className="text-[#007a42]/70 dark:text-emerald-300/70">·</span>
                          <span>{labelRight}</span>
                          {p.needs_review ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                              Review
                            </span>
                          ) : null}
                        </button>
                      )
                    })
                  )}
                </div>
                {policyFilterHash ? (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Showing {visibleHistory.length} feedback item(s) that mention the selected policy.
                  </p>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      {openItem && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Feedback details"
          onClick={() => setOpenItem(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpenItem(null)
          }}
          tabIndex={-1}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-gray-100 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Feedback</h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{fmtRelative(openItem.created_at)}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenItem(null)}
                aria-label="Close"
                title="Close"
                className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-gray-200 bg-white px-2 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <FiX className="h-5 w-5" aria-hidden />
              </button>
            </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <SentimentPill label={openItem.sentiment_label} />
              <SourcePill
                source={openItem.source_group || openItem.source}
                label={
                  openItem.channel_label ||
                  openItem.channel_metadata?.channel_label ||
                  openItem.channel_metadata?.mailbox_label ||
                  undefined
                }
              />
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                ID #{openItem.id}
              </span>
            </div>

            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
              <div className="whitespace-pre-wrap break-words">
                {renderLinkedText(openItem.message || openItem.message_preview || '', {
                  policyMatches: [...safeArr(openItem.policy_matches), ...policySummary],
                  onPolicyClick: (hash) => {
                    setOpenItem(null)
                    setPolicyFilterHash(hash)
                    document.getElementById('cfp-customer-products')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'nearest',
                    })
                  },
                })}
              </div>
            </div>

            {safeArr(openItem?.channel_metadata?.media).length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Attachments</h3>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {safeArr(openItem.channel_metadata.media).slice(0, 6).map((m, idx) => {
                    const url = String(m?.url || '').trim()
                    if (!url) return null
                    const type = String(m?.type || 'file').toLowerCase()
                    if (type === 'image') {
                      return (
                        <a
                          key={`${url}-${idx}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="group overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
                          onClick={(e) => e.stopPropagation()}
                          title="Open image"
                        >
                          <img
                            src={m.thumb_url || url}
                            alt={m.caption || 'Feedback image'}
                            className="h-40 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                            loading="lazy"
                          />
                          {(m.caption || m.mime_type) && (
                            <div className="px-3 py-2 text-[11px] text-gray-600 dark:text-gray-300">{m.caption || m.mime_type}</div>
                          )}
                        </a>
                      )
                    }
                    return (
                      <a
                        key={`${url}-${idx}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {m.caption || url}
                      </a>
                    )
                  })}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

