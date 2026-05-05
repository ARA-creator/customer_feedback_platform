import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FiAlertCircle, FiArchive, FiCalendar, FiEye, FiInbox, FiRefreshCw, FiSearch, FiX } from 'react-icons/fi'
import { FaEnvelope, FaFacebook, FaGoogle, FaInstagram, FaTiktok, FaWhatsapp, FaXTwitter } from 'react-icons/fa6'
import { FiGlobe } from 'react-icons/fi'
import { addPolicyNumber, removePolicyMatches, setPrimaryPolicyMatch, getFeedbackFeed, getFeedbackPolicyMatches, getSourceCounts } from '../services/inbox.api'
import { EmptyState, InboxListSkeleton, LastUpdated, PageIntro } from '../../../shared/components/ui'

const SOURCE_ORDER = ['all', 'email', 'web', 'google_forms', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'x']

const INBOX_PAGE_SIZE = 5

const SENTIMENT_COLORS = {
  positive: '#6FBF73',
  neutral: '#E6C76B',
  negative: '#D96C6C',
}

function normalizeSourceGroup(value) {
  const s = String(value || '').toLowerCase()
  if (!s) return ''
  if (s === 'email' || s.includes('mail')) return 'email'
  if (s === 'web' || s.startsWith('web_') || s.startsWith('web-') || s.includes('webform')) return 'web'
  if (s.includes('whatsapp')) return 'whatsapp'
  if (s === 'x' || s.includes('x_') || s.includes('x-') || s.includes('x ') || s.includes('twitter')) return 'x'
  if (s.includes('tiktok')) return 'tiktok'
  if (s.includes('instagram')) return 'instagram'
  if (s.includes('facebook')) return 'facebook'
  if (s.includes('google')) return 'google_forms'
  return s
}

function SourceIcon({ source }) {
  const s = normalizeSourceGroup(source)
  const className = 'h-3.5 w-3.5'
  if (s === 'whatsapp') return <FaWhatsapp className={className} style={{ color: '#25D366' }} aria-label="WhatsApp" />
  if (s === 'instagram') return <FaInstagram className={className} style={{ color: '#E1306C' }} aria-label="Instagram" />
  if (s === 'facebook') return <FaFacebook className={className} style={{ color: '#1877F2' }} aria-label="Facebook" />
  if (s === 'tiktok') return <FaTiktok className={className} style={{ color: '#00F2EA' }} aria-label="TikTok" />
  if (s === 'google_forms') return <FaGoogle className={className} style={{ color: '#4285F4' }} aria-label="Google Forms" />
  if (s === 'email') return <FaEnvelope className={className} style={{ color: '#6B7280' }} aria-label="Email" />
  if (s === 'x') return <FaXTwitter className={className} style={{ color: '#111827' }} aria-label="X" />
  if (s === 'web') return <FiGlobe className={className} aria-label="Web" />
  return <FiGlobe className={className} aria-label="Channel" />
}

function formatRelativeTime(iso) {
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

function extractUrls(text) {
  const s = String(text || '')
  const re = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/gi
  const out = []
  let m
  while ((m = re.exec(s))) {
    const raw = m[0]
    const url = raw.startsWith('http') ? raw : `https://${raw}`
    out.push(url)
    if (out.length >= 8) break
  }
  return out
}

function renderLinkedText(text) {
  const s = String(text || '')
  const re = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/gi
  const parts = []
  let last = 0
  let m
  while ((m = re.exec(s))) {
    const start = m.index
    const raw = m[0]
    const url = raw.startsWith('http') ? raw : `https://${raw}`
    if (start > last) parts.push(s.slice(last, start))
    parts.push(
      <a
        key={`${start}-${raw}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-[#009750] underline break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {raw}
      </a>
    )
    last = start + raw.length
  }
  if (last < s.length) parts.push(s.slice(last))
  return parts.length ? parts : s
}

function safeArr(x) {
  return Array.isArray(x) ? x : []
}

function getPolicySummary(item) {
  const matches = safeArr(item?.policy_matches)
  if (!matches.length) return null
  const primary = matches.find((m) => m && m.is_primary) || matches[0]
  if (!primary) return null
  const labelLeft = primary.product_group || primary.product_prefix || 'product'
  const labelRight = primary.policy_masked || 'policy'
  const extra = Math.max(0, matches.length - 1)
  const needsReview = matches.some((m) => m && m.needs_review)
  return { primary, labelLeft, labelRight, extra, needsReview, matches }
}

/** Tooltip copy for product/policy chips — avoids jargon; clarifies name-only inference. */
function policyMatchHelp(masked, needsReview) {
  const m = String(masked || '')
  const bits = []
  if (m.includes('(name match)')) {
    bits.push('Primary product inferred from the plan name in the message (no policy number detected).')
  } else {
    bits.push('Detected product or policy reference from the message. Sensitive parts stay masked.')
  }
  if (needsReview) bits.push('Please confirm—ambiguous match or needs verification.')
  return bits.join(' ')
}

function SentimentPill({ label }) {
  const s = String(label || 'unknown').toLowerCase()
  const style =
    s === 'negative'
      ? {
          backgroundColor: 'rgba(217, 108, 108, 0.18)',
          color: SENTIMENT_COLORS.negative,
          border: '1px solid rgba(217, 108, 108, 0.35)',
        }
      : s === 'positive'
        ? {
            backgroundColor: 'rgba(111, 191, 115, 0.18)',
            color: SENTIMENT_COLORS.positive,
            border: '1px solid rgba(111, 191, 115, 0.35)',
          }
        : {
            backgroundColor: 'rgba(230, 199, 107, 0.22)',
            color: '#6d5c24',
            border: `1px solid ${SENTIMENT_COLORS.neutral}`,
          }
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={style}
    >
      {s}
    </span>
  )
}

function formatSourceLabel(k) {
  const s = k === 'all' ? 'All channels' : normalizeSourceGroup(k).replace(/_/g, ' ')
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

function fmtDateOnly(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  // Use UTC date to match backend parsing (YYYY-MM-DD => UTC midnight).
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function addUtcDays(d, days) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000)
}

export default function InboxLite({ onNavigate }) {
  const [items, setItems] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [source, setSource] = useState('all')
  const [sentiment, setSentiment] = useState('all')
  const [q, setQ] = useState('')
  const [qDraft, setQDraft] = useState('')
  const [insuranceTagFilter, setInsuranceTagFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('')

  const [dateRange, setDateRange] = useState('all') // all | yesterday | 7d | 14d | 30d | custom
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const [peakDow, setPeakDow] = useState(null)
  const [peakHour, setPeakHour] = useState(null)
  const [peakRangeDays, setPeakRangeDays] = useState(null)
  const loadSeq = useRef(0)
  const [lastLoadedAt, setLastLoadedAt] = useState(null)
  const [listHighlightId, setListHighlightId] = useState(null)
  const listHighlightRef = useRef(null)

  const [openFeedbackId, setOpenFeedbackId] = useState(null)
  const [openItem, setOpenItem] = useState(null)
  const [policyBusy, setPolicyBusy] = useState(false)
  const [policyError, setPolicyError] = useState('')
  const [addPolicyDraft, setAddPolicyDraft] = useState('')


  const [archivedIds, setArchivedIds] = useState(() => {
    try {
      const raw = localStorage.getItem('cfp_archived_feedback_ids')
      const arr = raw ? JSON.parse(raw) : []
      return new Set(Array.isArray(arr) ? arr : [])
    } catch {
      return new Set()
    }
  })
  const [folder, setFolder] = useState('inbox') // inbox | archive
  const [listDisplayCount, setListDisplayCount] = useState(INBOX_PAGE_SIZE)
  const loadMoreSentinelRef = useRef(null)
  const loadMoreCoolDownRef = useRef(false)
  const visibleItemsRef = useRef([])

  useEffect(() => {
    listHighlightRef.current = listHighlightId
  }, [listHighlightId])

  useEffect(() => {
    try {
      localStorage.setItem('cfp_archived_feedback_ids', JSON.stringify(Array.from(archivedIds)))
    } catch {
      // ignore
    }
  }, [archivedIds])

  useEffect(() => {
    if (openItem) setListHighlightId(null)
  }, [openItem])

  const refreshOpenPolicyMatches = useCallback(async (feedbackId) => {
    if (!feedbackId) return null
    const res = await getFeedbackPolicyMatches(feedbackId)
    return safeArr(res?.items)
  }, [])

  const applyPolicyMatchesToState = useCallback((feedbackId, nextMatches) => {
    setOpenItem((prev) => {
      if (!prev || prev.id !== feedbackId) return prev
      return { ...prev, policy_matches: safeArr(nextMatches) }
    })
    setItems((prev) =>
      safeArr(prev).map((it) => (it && it.id === feedbackId ? { ...it, policy_matches: safeArr(nextMatches) } : it)),
    )
  }, [])

  const withPolicyBusy = useCallback(async (fn) => {
    setPolicyBusy(true)
    setPolicyError('')
    try {
      return await fn()
    } catch (e) {
      setPolicyError(e?.response?.data?.error || e?.message || 'Failed to update policy matches')
      return null
    } finally {
      setPolicyBusy(false)
    }
  }, [])


  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('cfp_inbox_peak_preset')
      if (!raw) return
      sessionStorage.removeItem('cfp_inbox_peak_preset')
      const preset = JSON.parse(raw)
      const dow = Number.isFinite(Number(preset?.dow)) ? Number(preset.dow) : null
      const hour = Number.isFinite(Number(preset?.hour)) ? Number(preset.hour) : null
      const rangeDays = Number.isFinite(Number(preset?.range_days)) ? Number(preset.range_days) : null
      if (dow != null && dow >= 0 && dow <= 6) setPeakDow(dow)
      if (hour != null && hour >= 0 && hour <= 23) setPeakHour(hour)
      if (rangeDays != null && [7, 30, 90].includes(rangeDays)) setPeakRangeDays(rangeDays)
      // Keep the Inbox date dropdown free for user changes; default to "All time" and rely on range_days.
      setDateRange('all')
    } catch {
      // ignore
    }
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('cfp_inbox_anomaly_preset')
      if (!raw) return
      sessionStorage.removeItem('cfp_inbox_anomaly_preset')
      const preset = JSON.parse(raw)
      if (!preset || typeof preset !== 'object') return
      if (typeof preset.source === 'string' && preset.source.trim()) {
        setSource(preset.source.trim().toLowerCase())
      }
      if (typeof preset.sentiment === 'string' && preset.sentiment) {
        setSentiment(preset.sentiment)
      }
      if (typeof preset.insurance_tag === 'string' && preset.insurance_tag) {
        setInsuranceTagFilter(preset.insurance_tag === 'all' ? 'all' : preset.insurance_tag)
      }
      if (typeof preset.location === 'string' && preset.location.trim()) {
        setLocationFilter(preset.location.trim())
      } else {
        setLocationFilter('')
      }
      const dr = preset.date_range
      if (dr === '7d' || dr === '14d' || dr === '30d' || dr === 'yesterday' || dr === 'all' || dr === 'custom') {
        setDateRange(dr)
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('cfp_inbox_open_feedback_id')
      if (!raw) return
      sessionStorage.removeItem('cfp_inbox_open_feedback_id')
      const id = Number(raw)
      if (Number.isFinite(id)) setOpenFeedbackId(id)
    } catch {
      // ignore
    }
  }, [])

  const dateParams = useMemo(() => {
    const todayUtc = startOfUtcDay(new Date())
    if (dateRange === 'all') return { date_from: undefined, date_to: undefined }
    if (dateRange === 'yesterday') {
      const y = addUtcDays(todayUtc, -1)
      const from = fmtDateOnly(y)
      const to = fmtDateOnly(todayUtc) // inclusive up to today 00:00; good enough for day buckets
      return { date_from: from, date_to: to }
    }
    if (dateRange === '7d') return { date_from: fmtDateOnly(addUtcDays(todayUtc, -7)), date_to: undefined }
    if (dateRange === '14d') return { date_from: fmtDateOnly(addUtcDays(todayUtc, -14)), date_to: undefined }
    if (dateRange === '30d') return { date_from: fmtDateOnly(addUtcDays(todayUtc, -30)), date_to: undefined }
    if (dateRange === 'custom') {
      const df = customFrom && customFrom.length === 10 ? customFrom : undefined
      const dt = customTo && customTo.length === 10 ? customTo : undefined
      return { date_from: df, date_to: dt }
    }
    return { date_from: undefined, date_to: undefined }
  }, [dateRange, customFrom, customTo])

  const sourceTabs = useMemo(() => {
    const c = counts || {}
    const keys = new Set([...Object.keys(c || {}), ...SOURCE_ORDER])
    const ordered = SOURCE_ORDER.filter((k) => keys.has(k))
    const rest = Array.from(keys).filter((k) => !ordered.includes(k)).sort()
    return [...ordered, ...rest].filter(Boolean)
  }, [counts])

  const selectedSourceLabel = useMemo(() => formatSourceLabel(source), [source])
  const selectedSourceCount = useMemo(() => {
    const n = Number(counts?.[source] ?? counts?.[String(source || '').toLowerCase()] ?? 0)
    return Number.isFinite(n) ? n : 0
  }, [counts, source])

  const load = async () => {
    const seq = ++loadSeq.current
    setLoading(true)
    setError(null)
    try {
      const loc = typeof locationFilter === 'string' ? locationFilter.trim() : ''
      const params = {
        source: source === 'all' ? 'all' : source,
        sentiment,
        q: q || undefined,
        limit: 50,
        insurance_tag: insuranceTagFilter !== 'all' ? insuranceTagFilter : undefined,
        location: loc || undefined,
        ...dateParams,
        dow: peakDow ?? undefined,
        hour: peakHour ?? undefined,
        range_days: peakRangeDays ?? undefined,
      }
      const [feed, sc] = await Promise.all([getFeedbackFeed(params), getSourceCounts(params)])
      if (seq !== loadSeq.current) return
      setItems(Array.isArray(feed?.items) ? feed.items : [])
      const grouped = sc?.grouped && typeof sc.grouped === 'object' ? sc.grouped : null
      const raw = sc?.raw && typeof sc.raw === 'object' ? sc.raw : null
      const total = Number(sc?.total ?? 0)
      // Prefer grouped counts (normalized to our channel tabs). Fall back to raw.
      const base = grouped || raw || {}
      setCounts({ all: Number.isFinite(total) ? total : 0, ...base })
      setLastLoadedAt(new Date())
    } catch (e) {
      if (seq !== loadSeq.current) return
      setError(e?.response?.data?.error || e?.message || 'Failed to load inbox')
      setItems([])
      setCounts({})
      setLastLoadedAt(null)
    } finally {
      if (seq !== loadSeq.current) return
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, sentiment, q, insuranceTagFilter, locationFilter, dateParams, peakDow, peakHour, peakRangeDays])

  useEffect(() => {
    if (!openFeedbackId) return
    const it = (items || []).find((x) => Number(x?.id) === Number(openFeedbackId))
    if (it) {
      setOpenItem(it)
      setOpenFeedbackId(null)
    }
  }, [openFeedbackId, items])

  useEffect(() => {
    setListDisplayCount(INBOX_PAGE_SIZE)
  }, [source, sentiment, q, insuranceTagFilter, locationFilter, dateParams, folder, peakDow, peakHour, peakRangeDays, items])

  const INSURANCE_TAG_OPTIONS = [
    'claims',
    'benefits',
    'billing',
    'premiums',
    'policy',
    'underwriting',
    'support',
    'digital',
    'trust_fairness',
    'speed_delays',
    'other',
  ]

  const { visibleItems, inboxCount, archiveCount } = useMemo(() => {
    const arr = Array.isArray(items) ? items : []
    let a = 0
    let i = 0
    for (const it of arr) {
      if (archivedIds.has(it?.id)) a += 1
      else i += 1
    }
    const showArchive = folder === 'archive'
    const filtered = arr.filter((it) => (showArchive ? archivedIds.has(it?.id) : !archivedIds.has(it?.id)))
    return { visibleItems: filtered, inboxCount: i, archiveCount: a }
  }, [items, archivedIds, folder])

  const displayedItems = useMemo(
    () => visibleItems.slice(0, listDisplayCount),
    [visibleItems, listDisplayCount],
  )
  const hasMoreToShow = visibleItems.length > listDisplayCount

  visibleItemsRef.current = visibleItems

  useEffect(() => {
    setListHighlightId(null)
  }, [source, sentiment, q, insuranceTagFilter, locationFilter, dateParams, folder, peakDow, peakHour, peakRangeDays])

  /** Power-user list navigation: J/K move, Enter opens (skipped inside inputs / when modal open). */
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (openItem) return
      if (!visibleItems.length) return
      const ids = visibleItems.map((x) => x.id)
      const cur = listHighlightRef.current
      let idx = cur != null ? ids.indexOf(cur) : -1

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        const next = idx < 0 ? 0 : Math.min(idx + 1, ids.length - 1)
        const nid = ids[next]
        setListHighlightId(nid)
        setListDisplayCount((c) => Math.min(visibleItems.length, Math.max(c, next + 1)))
        queueMicrotask(() => {
          document.querySelector(`[data-feedback-id="${nid}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        })
      }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        const next = idx < 0 ? 0 : Math.max(idx - 1, 0)
        const nid = ids[next]
        setListHighlightId(nid)
        queueMicrotask(() => {
          document.querySelector(`[data-feedback-id="${nid}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        })
      }
      if (e.key === 'Enter') {
        const id = listHighlightRef.current
        if (id == null) return
        e.preventDefault()
        const it = visibleItems.find((x) => x.id === id)
        if (it) setOpenItem(it)
      }
      if (e.key === 'Escape') {
        setListHighlightId(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [visibleItems, openItem])

  const loadNextBatch = useCallback(() => {
    setListDisplayCount((c) => {
      const total = visibleItemsRef.current.length
      if (c >= total) return c
      return Math.min(c + INBOX_PAGE_SIZE, total)
    })
  }, [])

  useEffect(() => {
    const el = loadMoreSentinelRef.current
    if (!el || !hasMoreToShow) return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadMoreCoolDownRef.current) return
        loadMoreCoolDownRef.current = true
        loadNextBatch()
        window.setTimeout(() => {
          loadMoreCoolDownRef.current = false
        }, 700)
      },
      { root: null, rootMargin: '200px 0px 200px 0px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMoreToShow, listDisplayCount, loadNextBatch, visibleItems.length])

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageIntro
          title="Feedback inbox"
          subtitle="Review every message in one place—sentiment, channel, and the primary product we detected."
          hint="Tip: with the list focused (click outside search), press J and K to move, Enter to open, Esc to clear."
        />
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-full border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900"
            role="tablist"
            aria-label="Inbox folders"
          >
            {[
              { key: 'inbox', label: 'Inbox', Icon: FiInbox, count: inboxCount },
              { key: 'archive', label: 'Archive', Icon: FiArchive, count: archiveCount },
            ].map(({ key, label, Icon, count }) => {
              const active = folder === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFolder(key)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#009750]/40 ${
                    active
                      ? 'bg-[#009750] text-white'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800'
                  }`}
                  role="tab"
                  aria-selected={active}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      active ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {Number.isFinite(count) ? count : 0}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={load}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </button>
            {!loading && lastLoadedAt ? <LastUpdated at={lastLoadedAt} /> : null}
          </div>
        </div>
      </div>

      <div className="card p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
            <FiSearch className="h-4 w-4 text-gray-500" />
            <input
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              placeholder="Search feedback…"
              className="w-64 bg-transparent outline-none placeholder:text-gray-400"
            />
          </div>
          <button
            type="button"
            onClick={() => setQ(qDraft.trim())}
            className="inline-flex min-h-[40px] items-center rounded-lg bg-[#009750] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#007a42]"
          >
            Search
          </button>
          <select
            value={sentiment}
            onChange={(e) => setSentiment(e.target.value)}
            className="min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="all">All sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>

          <details className="relative">
            <summary
              className="list-none inline-flex min-h-[44px] cursor-pointer select-none items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750]/40"
              aria-label="Filter by channel"
              title="Filter by channel"
            >
              <SourceIcon source={source} />
              <span className="max-w-[12rem] truncate">{selectedSourceLabel}</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                {selectedSourceCount}
              </span>
              <span className="ml-1 text-gray-400" aria-hidden>
                ▾
              </span>
            </summary>
            <div
              className="absolute left-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-950"
              role="menu"
              aria-label="Channel options"
            >
              <div className="max-h-72 overflow-y-auto p-1">
                {sourceTabs.map((k) => {
                  const label = formatSourceLabel(k)
                  const n = Number(counts?.[k] ?? counts?.[k.toLowerCase()] ?? 0)
                  const count = Number.isFinite(n) ? n : 0
                  const active = source === k
                  return (
                    <button
                      key={k}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => {
                        setSource(k)
                        // close the <details>
                        try {
                          document.activeElement?.closest?.('details')?.removeAttribute?.('open')
                        } catch {
                          // ignore
                        }
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${
                        active
                          ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                          : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900'
                      }`}
                      title={label}
                    >
                      {k !== 'all' ? <SourceIcon source={k} /> : <span className="inline-block h-3.5 w-3.5" aria-hidden />}
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          active
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </details>

          <select
            value={insuranceTagFilter}
            onChange={(e) => setInsuranceTagFilter(e.target.value)}
            className="min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            title="Filter by insurance tag"
            aria-label="Insurance tag"
          >
            <option value="all">All insurance tags</option>
            {INSURANCE_TAG_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
            <FiCalendar className="h-4 w-4 text-gray-500" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent outline-none"
            >
              <option value="all">All time</option>
              <option value="yesterday">Yesterday</option>
              <option value="7d">Last 7 days</option>
              <option value="14d">Last 2 weeks</option>
              <option value="30d">Last month</option>
              <option value="custom">Custom…</option>
            </select>
          </div>

          {peakDow != null && peakHour != null && (
            <button
              type="button"
              onClick={() => {
                setPeakDow(null)
                setPeakHour(null)
                setPeakRangeDays(null)
              }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/50"
              title="Clear peak-time filter"
            >
              <span>
                Time: {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][peakDow]} {String(peakHour).padStart(2, '0')}
                :00
                {peakRangeDays ? ` · last ${peakRangeDays}d` : ''}
              </span>
              <span className="text-emerald-700/80 dark:text-emerald-200/70">×</span>
            </button>
          )}

          {locationFilter.trim() ? (
            <button
              type="button"
              onClick={() => setLocationFilter('')}
              className="inline-flex min-h-[44px] max-w-[16rem] items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/50"
              title="Clear location filter"
            >
              <span className="min-w-0 truncate">Location: {locationFilter.trim()}</span>
              <span className="text-amber-800/80 dark:text-amber-200/70">×</span>
            </button>
          ) : null}
        </div>

        {dateRange === 'custom' && (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-400">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-400">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setCustomFrom('')
                setCustomTo('')
              }}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="card p-4 sm:p-6">
          <InboxListSkeleton rows={5} />
        </div>
      )}
      {!loading && error && (
        <div
          className="card p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-rose-200 bg-rose-50/80 dark:border-rose-900/40 dark:bg-rose-950/20"
          role="alert"
        >
          <div className="flex gap-3 text-sm text-rose-900 dark:text-rose-100">
            <FiAlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="font-semibold">Couldn’t load the inbox</p>
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
      {!loading && !error && visibleItems.length === 0 && (
        <EmptyState
          icon={FiInbox}
          title="No feedback matches these filters"
          description="Try widening the date range, switching channel, clearing search, or resetting sentiment to see more items."
          primaryAction={{
            label: 'Clear search',
            onClick: () => {
              setQDraft('')
              setQ('')
            },
          }}
          secondaryAction={{
            label: 'All channels & sentiments',
            onClick: () => {
              setSource('all')
              setSentiment('all')
              setInsuranceTagFilter('all')
              setDateRange('all')
              setPeakDow(null)
              setPeakHour(null)
              setPeakRangeDays(null)
              setLocationFilter('')
            },
          }}
        />
      )}

      {!loading && !error && visibleItems.length > 0 && (
        <div className="space-y-3">
          {displayedItems.map((it) => {
            const isArchived = archivedIds.has(it.id)
            const insuranceTags =
              it?.insurance_tags ||
              it?.channel_metadata?.insurance_tags ||
              []
            const insuranceTagsList = Array.isArray(insuranceTags) ? insuranceTags : []
            const pol = getPolicySummary(it)
            return (
            <div
              key={it.id}
              data-feedback-id={it.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                setOpenItem(it)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setOpenItem(it)
              }}
              className={`relative w-full text-left rounded-2xl border bg-white p-4 shadow-sm hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750]/40 ${
                listHighlightId === it.id
                  ? 'border-[#009750] ring-2 ring-[#009750]/35 ring-offset-2 ring-offset-[#f0f4f1] dark:ring-offset-gray-950'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
              aria-label="Open feedback details"
              aria-current={listHighlightId === it.id ? 'true' : undefined}
            >
              <div className="flex flex-wrap items-center gap-2">
                <SentimentPill label={it.sentiment_label} />
                <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                  {(it.source_group || it.source || 'source').replace(/_/g, ' ')}
                </span>
                {pol?.labelLeft && pol?.labelRight ? (
                  <span
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                    title={policyMatchHelp(pol.primary?.policy_masked, pol.needsReview)}
                  >
                    Primary product · {pol.labelLeft} · {pol.labelRight}
                    {pol.extra ? ` +${pol.extra}` : ''}
                  </span>
                ) : null}
                {pol?.needsReview ? (
                  <span
                    className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
                    title="Ambiguous or low-confidence match—open the card to confirm the primary product."
                  >
                    Needs review
                  </span>
                ) : null}
                {insuranceTagsList.slice(0, 3).map((t) => (
                  <span
                    key={`${it.id}-${t}`}
                    className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    title="Insurance tag"
                  >
                    {String(t).replace(/_/g, ' ')}
                  </span>
                ))}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {it.created_at ? formatRelativeTime(it.created_at) : ''}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setArchivedIds((prev) => {
                      const next = new Set(prev)
                      if (next.has(it.id)) next.delete(it.id)
                      else next.add(it.id)
                      return next
                    })
                  }}
                  className={`ml-auto inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    isArchived
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800'
                  }`}
                  title={isArchived ? 'Unarchive' : 'Archive'}
                >
                  <FiArchive className="h-3.5 w-3.5" />
                  {isArchived ? 'Unarchive' : 'Archive'}
                </button>
              </div>
              <p className="mt-3 max-h-[140px] overflow-hidden text-sm font-medium leading-6 text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
                {it.message || it.message_preview || 'No message'}
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {it.customer_label || it.customer_id || 'Unknown customer'}
              </p>
            </div>
            )
          })}
          {hasMoreToShow && (
            <>
              <div
                ref={loadMoreSentinelRef}
                className="h-2 w-full shrink-0"
                aria-hidden
              />
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={loadNextBatch}
                  className="text-sm font-semibold text-[#009750] hover:underline focus:outline-none focus:ring-2 focus:ring-[#009750]/40 rounded"
                >
                  Load more
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/** WhatsApp-style read ticks (brand green) */}
      {/*
        Rendered inside each card (absolute bottom-right) so it matches the reference:
        two ticks, slightly offset, thicker stroke, rounded ends.
      */}

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
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto overscroll-contain rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Feedback</h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {openItem.created_at ? formatRelativeTime(openItem.created_at) : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const key = String(openItem?.customer_key || openItem?.channel_metadata?.customer_key || '').trim()
                  const canViewCustomer = !!key && typeof onNavigate === 'function'
                  return (
                    <button
                      type="button"
                      disabled={!canViewCustomer}
                      onClick={() => {
                        if (!key || typeof onNavigate !== 'function') return
                        try {
                          sessionStorage.setItem('cfp_customer_key', key)
                        } catch {
                          // ignore
                        }
                        setOpenItem(null)
                        onNavigate('customer')
                      }}
                      aria-label="View customer"
                      title={canViewCustomer ? 'View customer' : 'No customer identifier found for this feedback yet'}
                      className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/50"
                    >
                      <FiEye className="h-5 w-5" aria-hidden />
                    </button>
                  )
                })()}
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

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <SentimentPill label={openItem.sentiment_label} />
              <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                {(openItem.source_group || openItem.source || 'source').replace(/_/g, ' ')}
              </span>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                ID #{openItem.id}
              </span>
            </div>

            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-900/80 dark:text-emerald-200/80">
                      Product & policy matches
                    </h3>
                    <p className="mt-0.5 text-[11px] text-emerald-900/70 dark:text-emerald-200/60">
                      We highlight one primary match; change it if the customer meant a different plan.
                    </p>
                  </div>
                  {safeArr(openItem?.policy_matches).some((m) => m && m.needs_review) ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                      Needs review
                    </span>
                  ) : null}
                </div>
                {policyError ? (
                  <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
                    {policyError}
                  </div>
                ) : null}

                {safeArr(openItem?.policy_matches).length === 0 ? (
                  <p className="mt-3 text-sm text-gray-700 dark:text-gray-200">No policies detected yet.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {safeArr(openItem?.policy_matches).map((m) => {
                      const key = `${openItem.id}-${m.policy_hash || m.policy_masked || Math.random()}`
                      const isPrimary = !!m.is_primary
                      const product = m.product_group || m.product_prefix || 'product'
                      return (
                        <div
                          key={key}
                          className={`rounded-xl border px-3 py-2 text-sm ${
                            isPrimary
                              ? 'border-emerald-300 bg-white dark:border-emerald-900/50 dark:bg-gray-950'
                              : 'border-emerald-200/70 bg-white/70 dark:border-emerald-900/30 dark:bg-gray-950/40'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                                  {product}
                                </span>
                                {m.policy_masked ? (
                                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{m.policy_masked}</span>
                                ) : null}
                                {isPrimary ? (
                                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
                                    Primary
                                  </span>
                                ) : null}
                                {m.needs_review ? (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                                    Review
                                  </span>
                                ) : null}
                              </div>
                              {m.product_description ? (
                                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{m.product_description}</p>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-2">
                              {typeof m.confidence === 'number' ? (
                                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400" title="Match confidence">
                                  {(Math.max(0, Math.min(1, m.confidence)) * 100).toFixed(0)}%
                                </span>
                              ) : null}

                              {!isPrimary && m.policy_hash ? (
                                <button
                                  type="button"
                                  disabled={policyBusy}
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    const fid = openItem.id
                                    const res = await withPolicyBusy(() => setPrimaryPolicyMatch(fid, m.policy_hash))
                                    const next = safeArr(res?.items)
                                    if (next.length) applyPolicyMatchesToState(fid, next)
                                  }}
                                  className="inline-flex min-h-[32px] items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/50"
                                  title="Make this the primary product for this feedback thread"
                                >
                                  Make primary
                                </button>
                              ) : null}

                              {m.policy_hash ? (
                                <button
                                  type="button"
                                  disabled={policyBusy}
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    const fid = openItem.id
                                    const res = await withPolicyBusy(() => removePolicyMatches(fid, [m.policy_hash]))
                                    const next = safeArr(res?.items)
                                    applyPolicyMatchesToState(fid, next)
                                  }}
                                  className="inline-flex min-h-[32px] items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900"
                                  title="Remove this policy match from this feedback"
                                >
                                  Remove
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[220px]">
                    <label className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300">Add policy number</label>
                    <input
                      value={addPolicyDraft}
                      onChange={(e) => setAddPolicyDraft(e.target.value)}
                      placeholder="e.g. GH3V0949606"
                      className="w-full min-h-[40px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={policyBusy || !String(addPolicyDraft || '').trim()}
                    onClick={async (e) => {
                      e.stopPropagation()
                      const fid = openItem.id
                      const raw = String(addPolicyDraft || '').trim()
                      if (!raw) return
                      const res = await withPolicyBusy(() => addPolicyNumber(fid, raw))
                      const next = safeArr(res?.items)
                      if (next.length) applyPolicyMatchesToState(fid, next)
                      setAddPolicyDraft('')
                    }}
                    className="inline-flex min-h-[40px] items-center rounded-lg bg-[#009750] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#007a42] disabled:cursor-not-allowed disabled:opacity-60"
                    title="Add a policy number to this feedback (policy will be hashed + masked)"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    disabled={policyBusy}
                    onClick={async (e) => {
                      e.stopPropagation()
                      const fid = openItem.id
                      const items = await withPolicyBusy(() => refreshOpenPolicyMatches(fid))
                      if (items) applyPolicyMatchesToState(fid, items)
                    }}
                    className="inline-flex min-h-[40px] items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900"
                    title="Refresh policies"
                  >
                    Refresh
                  </button>
                </div>
              </div>

            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
              <div className="whitespace-pre-wrap break-words">
                {renderLinkedText(openItem.message || openItem.message_preview || 'No message')}
              </div>
            </div>

            {Array.isArray(openItem?.channel_metadata?.media) && openItem.channel_metadata.media.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Attachments
                </h3>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {openItem.channel_metadata.media.slice(0, 6).map((m, idx) => {
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
                            <div className="px-3 py-2 text-[11px] text-gray-600 dark:text-gray-300">
                              {m.caption || m.mime_type}
                            </div>
                          )}
                        </a>
                      )
                    }
                    if (type === 'video') {
                      return (
                        <div
                          key={`${url}-${idx}`}
                          className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
                        >
                          <video controls src={url} className="h-40 w-full object-cover" />
                          <div className="px-3 py-2 text-[11px] text-gray-600 dark:text-gray-300">
                            {m.caption || 'Video attachment'}
                          </div>
                        </div>
                      )
                    }
                    if (type === 'audio') {
                      return (
                        <div
                          key={`${url}-${idx}`}
                          className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950"
                        >
                          <audio controls src={url} className="w-full" />
                          <div className="mt-2 text-[11px] text-gray-600 dark:text-gray-300">
                            {m.caption || 'Audio attachment'}
                          </div>
                        </div>
                      )
                    }
                    // link/file
                    return (
                      <a
                        key={`${url}-${idx}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900"
                        onClick={(e) => e.stopPropagation()}
                        title="Open link"
                      >
                        <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                          {type === 'link' ? 'Link' : 'File'}
                        </div>
                        <div className="mt-1 break-all text-[#009750] underline">{url}</div>
                        {m.caption && <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">{m.caption}</div>}
                      </a>
                    )
                  })}
                </div>
              </div>
            )}

            {extractUrls(openItem.message || openItem.message_preview).length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Links
                </h3>
                <div className="mt-2 flex flex-col gap-2">
                  {extractUrls(openItem.message || openItem.message_preview).map((u) => (
                    <a
                      key={u}
                      href={u}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#009750] underline break-all hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {u}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {openItem.customer_label || openItem.customer_id || 'Unknown customer'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

