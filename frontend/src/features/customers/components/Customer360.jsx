import { useEffect, useMemo, useState } from 'react'
import { FiAlertCircle, FiArrowLeft, FiRefreshCw, FiUser, FiX } from 'react-icons/fi'
import { getCustomerProfile } from '../services/customers.api'
import { Customer360Skeleton, LastUpdated, PageIntro } from '../../../shared/components/ui'

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

function extractUrls(text) {
  const s = String(text || '')
  const re = /\bhttps?:\/\/[^\s<>"')]+/gi
  const matches = s.match(re)
  return matches ? Array.from(new Set(matches)) : []
}

function renderLinkedText(text) {
  const s = String(text || '')
  const re = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/gi
  const parts = []
  let last = 0
  let m
  let linkIdx = 0
  while ((m = re.exec(s))) {
    const start = m.index
    const raw = m[0]
    const url = raw.startsWith('http') ? raw : `https://${raw}`
    if (start > last) parts.push(s.slice(last, start))
    parts.push(
      <a
        key={`link-${linkIdx}-${start}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-[#009750] hover:underline break-words"
        onClick={(e) => e.stopPropagation()}
      >
        {raw}
      </a>,
    )
    linkIdx += 1
    last = start + raw.length
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
  const [lastLoadedAt, setLastLoadedAt] = useState(null)
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
    for (const it of safeArr(history)) {
      for (const m of safeArr(it?.policy_matches)) {
        if (!m || !m.policy_hash) continue
        const key = m.policy_hash
        if (!map.has(key)) {
          map.set(key, {
            policy_hash: m.policy_hash,
            policy_masked: m.policy_masked,
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
        row.policy_masked = row.policy_masked || m.policy_masked
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.total_mentions || 0) - (a.total_mentions || 0))
  }, [history])
  const openTickets = useMemo(() => safeArr(data?.tickets).filter((t) => String(t?.status || '').toLowerCase() !== 'closed'), [data])

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
      setLastLoadedAt(new Date())
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load customer')
      setLastLoadedAt(null)
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
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#009750]/10 text-[#009750] dark:bg-emerald-500/10 dark:text-emerald-300">
            <FiUser className="h-5 w-5" aria-hidden />
          </div>
          <PageIntro
            title={data?.customer?.label || 'Customer 360'}
            subtitle={
              customerKey
                ? 'One view of every touchpoint we can link to this customer—including products inferred from their messages.'
                : 'Search or open a profile from the inbox to load a customer.'
            }
          />
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={() => (typeof onNavigate === 'function' ? onNavigate('inbox') : null)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <FiArrowLeft className="h-4 w-4" aria-hidden />
              Back to inbox
            </button>
            <button
              type="button"
              onClick={load}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </button>
          </div>
          {!loading && lastLoadedAt ? <LastUpdated at={lastLoadedAt} /> : null}
        </div>
      </div>

      {customerKey ? (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 break-all font-mono">{customerKey}</p>
      ) : null}

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
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => setOpenItem(it)}
                      className="w-full rounded-xl border border-gray-200 bg-white p-3 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750]/40 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <SentimentPill label={it.sentiment_label} />
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {(it.source_group || it.source || 'source').toString().replace(/_/g, ' ')}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{fmtRelative(it.created_at)}</span>
                      </div>
                      <p className="mt-2 text-sm text-gray-800 dark:text-gray-200 line-clamp-2 whitespace-pre-wrap">
                        {it.message_preview || it.message || ''}
                      </p>
                    </button>
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
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Total feedback</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{data.customer.total_feedback ?? history.length}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Open issues</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{openTickets.length}</p>
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
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Identifiers</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {safeArr(data.identifiers).length === 0 ? (
                    <p className="text-sm text-gray-600 dark:text-gray-300">No identifiers yet.</p>
                  ) : (
                    safeArr(data.identifiers).slice(0, 14).map((ident) => (
                      <button
                        key={ident.id}
                        type="button"
                        onClick={() => {
                          const v = String(ident?.identifier_value || '')
                          if (v.startsWith('policy_hash:')) {
                            setPolicyFilterHash(v.replace(/^policy_hash:/, '').trim())
                          }
                        }}
                        className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900"
                        title={ident.identifier_value}
                      >
                        {(ident.identifier_type || 'id').toString().replace(/_/g, ' ')}: {ident.label || ident.identifier_value}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Products & policies</h2>
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
                      No linked products yet—when feedback mentions a plan name or policy reference, chips appear here.
                    </p>
                  ) : (
                    policySummary.slice(0, 18).map((p) => {
                      const isActive = policyFilterHash && p.policy_hash === policyFilterHash
                      const labelLeft = p.product_group || p.product_prefix || 'product'
                      const labelRight = p.policy_masked || 'policy'
                      return (
                        <button
                          key={p.policy_hash}
                          type="button"
                          onClick={() => setPolicyFilterHash((prev) => (prev === p.policy_hash ? '' : p.policy_hash))}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                            isActive
                              ? 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-200'
                              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900'
                          }`}
                          title={p.policy_hash}
                        >
                          <span>{labelLeft}</span>
                          <span className="text-gray-500 dark:text-gray-400">·</span>
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

              <div className="card p-5">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Open issues</h2>
                <div className="mt-3 space-y-2">
                  {openTickets.length === 0 ? (
                    <p className="text-sm text-gray-600 dark:text-gray-300">No open tickets found.</p>
                  ) : (
                    openTickets.slice(0, 8).map((t) => (
                      <div
                        key={t.id}
                        className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{t.subject || t.ticket_ref || 'Ticket'}</p>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{String(t.status || 'open')}</span>
                        </div>
                        {t.summary && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{t.summary}</p>}
                      </div>
                    ))
                  )}
                </div>
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
              <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                {(openItem.source_group || openItem.source || 'source').toString().replace(/_/g, ' ')}
              </span>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                ID #{openItem.id}
              </span>
            </div>

            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
              <div className="whitespace-pre-wrap break-words">{renderLinkedText(openItem.message || openItem.message_preview || '')}</div>
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

