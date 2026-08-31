import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FiAlertCircle, FiArchive, FiBookmark, FiEye, FiInbox, FiMail, FiRefreshCw, FiX } from 'react-icons/fi'
import { FaEnvelope, FaFacebook, FaGoogle, FaInstagram, FaTiktok, FaWhatsapp, FaXTwitter } from 'react-icons/fa6'
import { FiGlobe, FiLayers } from 'react-icons/fi'
import JotformIcon from '../../../shared/components/icons/JotformIcon'
import { addPolicyNumber, removePolicyMatches, setPrimaryPolicyMatch, getFeedbackFeed, getFeedbackOpenReaders, getFeedbackPolicyMatches, getSourceCounts, getWhatsAppThread, markFeedbackReplied } from '../services/inbox.api'
import { normFeedbackId, useInboxUserState } from '../hooks/useInboxUserState'
import { EmptyState, InboxListSkeleton } from '../../../shared/components/ui'
import { loadInboxPreferences } from '../../../shared/lib/inboxPreferences'
import { getBackendOrigin } from '../../../shared/lib/apiClient'
import { mergeFeedbackItems, maxFeedbackId } from '../../../shared/utils/mergeFeedbackItems'
import InboxFilterToolbar from './InboxFilterToolbar'
import InboxPageIntro from './InboxPageIntro'
import InboxSidebar from './InboxSidebar'
import InboxListPanel from './InboxListPanel'
import ChannelMessageView from './ChannelMessageView'
import SentimentCorrectControl from './SentimentCorrectControl'
import { channelKind } from '../utils/channelMessagePresentation'
import {
  computeInboxStats,
  computeStableUnreadCount,
  computeTopThemes,
  isHighPriority,
  isNewFeedback,
  needsResponse,
  sortInboxItems,
} from '../utils/inboxDerivedStats'

const SOURCE_ORDER = ['all', 'hnw_email', 'cx', 'web', 'jotform', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'x']

const SENTIMENT_FILTER_OPTIONS = ['negative', 'neutral', 'positive']

const INSURANCE_TAG_BASE = [
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

const INSURANCE_TAG_OPTIONS = [...INSURANCE_TAG_BASE].sort((a, b) =>
  a.replace(/_/g, ' ').localeCompare(b.replace(/_/g, ' '), undefined, { sensitivity: 'base' }),
)

const INBOX_PAGE_SIZE = 50
const INBOX_PAGE_SIZE_OPTIONS = [25, 50, 100]

const SENTIMENT_COLORS = {
  positive: '#6FBF73',
  neutral: '#E6C76B',
  negative: '#D96C6C',
}

function normalizeSourceGroup(value) {
  const s = String(value || '').toLowerCase().trim()
  if (!s) return ''
  if (s === 'hnw_email' || s === 'hnw' || s.includes('hnw')) return 'hnw_email'
  if (s === 'cx' || s === 'cx_email' || s === 'cx email') return 'cx'
  if (s.includes('whatsapp')) return 'whatsapp'
  if (s === 'email' || s === 'e-mail' || s.startsWith('email') || (s.includes('mail') && !s.includes('voice'))) return 'email'
  if (s === 'web' || s.startsWith('web_') || s.startsWith('web-') || s.includes('webform')) return 'web'
  if (s === 'x' || s.includes('x_') || s.includes('x-') || s.includes('x ') || s.includes('twitter')) return 'x'
  if (s.includes('tiktok')) return 'tiktok'
  if (s.includes('instagram')) return 'instagram'
  if (s.includes('facebook')) return 'facebook'
  if (s.includes('jotform')) return 'jotform'
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
  if (s === 'jotform') return <JotformIcon className={className} />
  if (s === 'google_forms') return <FaGoogle className={className} style={{ color: '#4285F4' }} aria-label="Google Forms" />
  if (s === 'email' || s === 'hnw_email' || s === 'cx') return <FaEnvelope className={className} style={{ color: '#6B7280' }} aria-label={s === 'cx' ? 'CX' : s === 'hnw_email' ? 'HNW email' : 'Email'} />
  if (s === 'x') return <FaXTwitter className={className} style={{ color: '#111827' }} aria-label="X" />
  if (s === 'all') return <FiLayers className={className} aria-label="All channels" />
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
  const re = /(https?:\/\/[^\s<>)"']+|www\.[^\s<>)"']+)/gi
  const out = []
  let m
  while ((m = re.exec(s))) {
    const raw = m[0].replace(/[.,;:]+$/g, '')
    const url = raw.startsWith('http') ? raw : `https://${raw}`
    if (!out.includes(url)) out.push(url)
    if (out.length >= 8) break
  }
  return out
}

function renderLinkedText(text) {
  const s = String(text || '')
  const re = /(https?:\/\/[^\s<>)"']+|www\.[^\s<>)"']+)/gi
  const parts = []
  let last = 0
  let m
  while ((m = re.exec(s))) {
    const start = m.index
    let raw = m[0]
    const trailing = raw.match(/[.,;:]+$/)?.[0] || ''
    if (trailing) raw = raw.slice(0, -trailing.length)
    const url = raw.startsWith('http') ? raw : `https://${raw}`
    if (start > last) parts.push(s.slice(last, start))
    parts.push(
      <a
        key={`${start}-${raw}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-[#009750] underline decoration-[#009750]/40 underline-offset-2 break-all hover:decoration-[#009750]"
        onClick={(e) => e.stopPropagation()}
      >
        {raw}
      </a>
    )
    last = start + m[0].length - trailing.length
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
  const key = String(k || '').toLowerCase()
  if (key === 'all') return 'All channels'
  if (key === 'hnw_email' || key === 'hnw') return 'HNW email'
  if (key === 'cx' || key === 'cx_email') return 'CX'
  const s = normalizeSourceGroup(k).replace(/_/g, ' ')
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
  const setChannelSource = useCallback((next) => {
    const v = String(next || 'all').toLowerCase().trim()
    // Legacy lumped "email" → All channels (mailboxes are HNW email / CX).
    if (v === 'email' || v === 'e-mail') {
      setSource('all')
      return
    }
    setSource(v || 'all')
  }, [])
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
  const [openReaders, setOpenReaders] = useState(null)
  const [whatsappThread, setWhatsappThread] = useState(null)
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
  const [listTab, setListTab] = useState('all') // all | read | unread | replied
  const [inboxTabCounts, setInboxTabCounts] = useState({ all: 0, read: 0, unread: 0, replied: 0 })
  const [sortBy, setSortBy] = useState('newest') // newest | oldest | priority
  const [activeQuickFilter, setActiveQuickFilter] = useState(null)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const { readIds, pinnedIds, mergeFromFeedItems, markIdsRead, markIdsUnread, togglePinned, setPinnedMany } =
    useInboxUserState()
  const openFeedback = useCallback(
    (it) => {
      const fid = normFeedbackId(it?.id)
      if (fid) markIdsRead([fid])
      setOpenItem(it)
    },
    [markIdsRead],
  )
  const openFeedbackFetchTriedRef = useRef(null)
  const [scopedInboxIds, setScopedInboxIds] = useState(() => new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(INBOX_PAGE_SIZE)
  const [feedTotal, setFeedTotal] = useState(0)
  const [feedHasMore, setFeedHasMore] = useState(false)
  const [pageLoading, setPageLoading] = useState(false)
  const visibleItemsRef = useRef([])
  const itemsRef = useRef([])
  const searchInputRef = useRef(null)
  const inboxTopRef = useRef(null)

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
    const onStorage = (e) => {
      if (e.key === 'cfp_archived_feedback_ids') {
        try {
          const arr = e.newValue ? JSON.parse(e.newValue) : []
          setArchivedIds(new Set(Array.isArray(arr) ? arr : []))
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    const onClear = () => setArchivedIds(new Set())
    window.addEventListener('cfp-archived-feedback-cleared', onClear)
    return () => window.removeEventListener('cfp-archived-feedback-cleared', onClear)
  }, [])

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
    let hasDrillDown = false
    try {
      hasDrillDown = Boolean(
        sessionStorage.getItem('cfp_inbox_peak_preset') ||
          sessionStorage.getItem('cfp_inbox_anomaly_preset'),
      )
    } catch {
      hasDrillDown = false
    }
    if (!hasDrillDown) {
      const { defaultSentiment } = loadInboxPreferences()
      if (defaultSentiment && defaultSentiment !== 'all') {
        setSentiment(defaultSentiment)
      }
    }

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
        setChannelSource(preset.source.trim().toLowerCase())
      }
      if (typeof preset.sentiment === 'string' && preset.sentiment) {
        setSentiment(preset.sentiment)
      }
      if (typeof preset.insurance_tag === 'string' && preset.insurance_tag) {
        setInsuranceTagFilter(preset.insurance_tag === 'all' ? 'all' : preset.insurance_tag)
      }
      if (typeof preset.search === 'string' && preset.search.trim()) {
        const s = preset.search.trim()
        setQ(s)
        setQDraft(s)
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
      if (preset.list_tab === 'read' || preset.list_tab === 'unread' || preset.list_tab === 'replied') {
        setListTab(preset.list_tab)
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
    if (dateRange === 'today') {
      return { date_from: fmtDateOnly(todayUtc), date_to: fmtDateOnly(addUtcDays(todayUtc, 1)) }
    }
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
    // Never show a lumped "Email" tab — mailboxes are HNW email + CX only.
    keys.delete('email')
    keys.add('hnw_email')
    keys.add('cx')
    const rest = Array.from(keys)
      .filter((k) => k && k !== 'all')
      .sort((a, b) => formatSourceLabel(a).localeCompare(formatSourceLabel(b), undefined, { sensitivity: 'base' }))
    return ['all', ...rest]
  }, [counts])

  const selectedSourceLabel = useMemo(() => formatSourceLabel(source), [source])
  const selectedSourceCount = useMemo(() => {
    if (source === 'all') {
      const n = Number(counts?.all ?? 0)
      return Number.isFinite(n) ? n : 0
    }
    if (source === 'email') {
      // Legacy selection → combined mailbox counts
      const n = Number(counts?.hnw_email || 0) + Number(counts?.cx || 0) + Number(counts?.email || 0)
      return Number.isFinite(n) ? n : 0
    }
    const n = Number(counts?.[source] ?? counts?.[String(source || '').toLowerCase()] ?? 0)
    return Number.isFinite(n) ? n : 0
  }, [counts, source])

  const sentimentOptions = useMemo(
    () => [
      { value: 'all', label: 'All sentiments' },
      ...SENTIMENT_FILTER_OPTIONS.map((s) => ({
        value: s,
        label: s.charAt(0).toUpperCase() + s.slice(1),
      })),
    ],
    [],
  )

  const themeOptions = useMemo(
    () => [
      { value: 'all', label: 'All themes' },
      ...INSURANCE_TAG_OPTIONS.map((t) => ({
        value: t,
        label: t.replace(/_/g, ' '),
      })),
    ],
    [],
  )

  const dateRangeOptions = useMemo(
    () => [
      { value: 'all', label: 'All time' },
      { value: 'today', label: 'Today' },
      { value: 'yesterday', label: 'Yesterday' },
      { value: '7d', label: 'Last 7 days' },
      { value: '14d', label: 'Last 2 weeks' },
      { value: '30d', label: 'Last month' },
      { value: 'custom', label: 'Custom…' },
    ],
    [],
  )

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const load = useCallback(
    async ({ soft = false } = {}) => {
      // Soft refresh must not cancel (or be cancelled by) hard loads via seq bumping.
      const seq = soft ? loadSeq.current : ++loadSeq.current
      const hasExisting = (itemsRef.current || []).length > 0
      const pageFlip = !soft && hasExisting
      const hardReplace = !soft && !pageFlip
      if (hardReplace) {
        setLoading(true)
        // Counts are filter-dependent; clear immediately to avoid showing stale totals
        // if the background counts request times out.
        setCounts({})
        setFeedHasMore(false)
      } else if (pageFlip || soft) {
        setPageLoading(true)
      }
      setError(null)
      try {
        const loc = typeof locationFilter === 'string' ? locationFilter.trim() : ''
        const isPriority = sortBy === 'priority'
        const offset = Math.max(0, (page - 1) * pageSize)
        const afterId =
          soft && page === 1 && hasExisting ? maxFeedbackId(itemsRef.current) : undefined
        const params = {
          source: source === 'all' ? 'all' : source,
          sentiment,
          q: q || undefined,
          limit: pageSize,
          offset: afterId ? 0 : offset,
          sort: isPriority ? 'impact' : 'chronological',
          insurance_tag: insuranceTagFilter !== 'all' ? insuranceTagFilter : undefined,
          location: loc || undefined,
          inbox_tab:
            listTab === 'read' || listTab === 'unread' || listTab === 'replied' || listTab === 'all'
              ? listTab
              : 'all',
          ...dateParams,
          dow: peakDow ?? undefined,
          hour: peakHour ?? undefined,
          range_days: peakRangeDays ?? undefined,
          ...(afterId ? { after_id: afterId } : {}),
        }
        const feed = await getFeedbackFeed(params)
        if (seq !== loadSeq.current) return
        const newItems = Array.isArray(feed?.items) ? feed.items : []
        const inboxIds = newItems
          .filter((it) => it?.id && !archivedIds.has(it.id))
          .map((it) => normFeedbackId(it.id))
          .filter(Boolean)
        if (soft) {
          // Append/update only — never wipe already-loaded rows or truncate the page.
          if (newItems.length) {
            setItems((prev) => mergeFeedbackItems(prev, newItems))
            setScopedInboxIds((prev) => {
              const next = new Set(prev)
              for (const id of inboxIds) next.add(id)
              return next
            })
          }
        } else {
          setItems(newItems)
          setScopedInboxIds(new Set(inboxIds))
        }
        mergeFromFeedItems(newItems)
        // Incremental after_id responses are not page windows — don't overwrite pagination.
        if (!afterId) {
          setFeedHasMore(Boolean(feed?.has_more))
        }
        const totalFromFeed = Number(feed?.total)
        if (Number.isFinite(totalFromFeed) && totalFromFeed >= 0) {
          setFeedTotal(totalFromFeed)
        }
        if (feed?.inbox_tab_counts && typeof feed.inbox_tab_counts === 'object') {
          const nextCounts = {
            all: Number(feed.inbox_tab_counts.all) || 0,
            read: Number(feed.inbox_tab_counts.read) || 0,
            unread: Number(feed.inbox_tab_counts.unread) || 0,
            replied: Number(feed.inbox_tab_counts.replied) || 0,
          }
          setInboxTabCounts(nextCounts)
          const tabKey = listTab === 'read' || listTab === 'unread' || listTab === 'replied' ? listTab : 'all'
          if (!(Number.isFinite(totalFromFeed) && totalFromFeed >= 0)) {
            setFeedTotal(Number(nextCounts[tabKey]) || 0)
          }
        }
        setLastLoadedAt(new Date())

        // Tab counts are secondary; don't block showing the feed if this is slow.
        try {
          const sc = await getSourceCounts(params)
          if (seq !== loadSeq.current) return
          const grouped = sc?.grouped && typeof sc.grouped === 'object' ? { ...sc.grouped } : {}
          const raw = sc?.raw && typeof sc.raw === 'object' ? { ...sc.raw } : {}
          const total = Number(sc?.total ?? 0)
          // Prefer grouped (includes HNW email / CX). Never keep a lumped "email" tab.
          const base = Object.keys(grouped).length ? grouped : { ...raw }
          delete base.email
          if (base.hnw_email == null) base.hnw_email = 0
          if (base.cx == null) base.cx = 0
          setCounts({ all: Number.isFinite(total) ? total : 0, ...base })
        } catch {
          // Keep feed visible; counts refresh on next load.
        }
      } catch (e) {
        if (seq !== loadSeq.current) return
        if (hardReplace) {
          const raw = e?.response?.data?.error || e?.message || 'Failed to load inbox'
          const msg =
            String(raw).toLowerCase().includes('timeout')
              ? 'The server is taking longer than usual (often Neon cold start). Try again in a moment, or check that the backend can reach the database.'
              : raw
          setError(msg)
          setItems([])
          setScopedInboxIds(new Set())
          setCounts({})
          setLastLoadedAt(null)
          setFeedHasMore(false)
          setFeedTotal(0)
        }
      } finally {
        if (seq !== loadSeq.current) return
        if (hardReplace) setLoading(false)
        setPageLoading(false)
      }
    },
    [
      source,
      sentiment,
      q,
      insuranceTagFilter,
      locationFilter,
      dateParams,
      peakDow,
      peakHour,
      peakRangeDays,
      sortBy,
      listTab,
      archivedIds,
      mergeFromFeedItems,
      page,
      pageSize,
    ],
  )

  useEffect(() => {
    const onOpen = (e) => {
      const id = Number(e?.detail?.feedbackId)
      if (!Number.isFinite(id) || id <= 0) return
      try {
        sessionStorage.removeItem('cfp_inbox_open_feedback_id')
      } catch {
        // ignore
      }
      setListTab('all')
      setPage(1)
      setOpenFeedbackId(id)
    }
    const onCreated = () => {
      if (page === 1) load({ soft: true })
    }
    window.addEventListener('cfp-open-inbox-feedback', onOpen)
    window.addEventListener('cfp-feedback-created', onCreated)
    return () => {
      window.removeEventListener('cfp-open-inbox-feedback', onOpen)
      window.removeEventListener('cfp-feedback-created', onCreated)
    }
  }, [load, page])

  useEffect(() => {
    load({ soft: false })
  }, [load])

  // Reset to first page when filters / tab / sort / page size change (not when page itself changes).
  const filterKey = [
    source,
    sentiment,
    q,
    insuranceTagFilter,
    locationFilter,
    JSON.stringify(dateParams),
    peakDow,
    peakHour,
    peakRangeDays,
    sortBy,
    listTab,
    pageSize,
  ].join('|')
  const filterKeyRef = useRef(filterKey)
  useEffect(() => {
    if (filterKeyRef.current === filterKey) return
    filterKeyRef.current = filterKey
    setPage(1)
  }, [filterKey])

  // Live feedback: soft-merge new rows without wiping the loaded list.
  useEffect(() => {
    let es
    let debounceTimer
    const softRefresh = () => {
      if (debounceTimer) window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        if (page === 1) load({ soft: true })
      }, 400)
    }
    try {
      es = new EventSource(`${getBackendOrigin()}/api/events`, { withCredentials: false })
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data?.type !== 'feedback_created') return
          softRefresh()
        } catch {
          // ignore malformed events
        }
      }
    } catch {
      return undefined
    }
    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer)
      try {
        es?.close()
      } catch {
        // ignore
      }
    }
  }, [load, page])

  useEffect(() => {
    if (!openFeedbackId) {
      openFeedbackFetchTriedRef.current = null
      return
    }
    const it = (items || []).find((x) => Number(x?.id) === Number(openFeedbackId))
    if (it) {
      openFeedback(it)
      setOpenFeedbackId(null)
      openFeedbackFetchTriedRef.current = null
      return
    }
    if (openFeedbackFetchTriedRef.current === openFeedbackId) return
    openFeedbackFetchTriedRef.current = openFeedbackId
    let cancelled = false
    ;(async () => {
      try {
        // Pull the specific row even if filters/page would hide it, then open it.
        const feed = await getFeedbackFeed({
          ids: String(openFeedbackId),
          limit: 1,
          inbox_tab: 'all',
        })
        if (cancelled) return
        const found = Array.isArray(feed?.items)
          ? feed.items.find((x) => Number(x?.id) === Number(openFeedbackId))
          : null
        if (found) {
          setItems((prev) =>
            mergeFeedbackItems(prev, [found], { max: Math.max(pageSize, (prev || []).length + 1) }),
          )
          openFeedback(found)
          setOpenFeedbackId(null)
          openFeedbackFetchTriedRef.current = null
          return
        }
        // Not found yet (race with ingest) — soft-refresh once; keep openFeedbackId for merge.
        if (page === 1) load({ soft: true })
      } catch {
        if (!cancelled && page === 1) load({ soft: true })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [openFeedbackId, items, openFeedback, load, page, pageSize])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const repliedCount = useMemo(() => {
    const tabs = inboxTabCounts?.replied
    if (Number.isFinite(tabs) && tabs >= 0) return tabs
    const arr = Array.isArray(items) ? items : []
    return arr.filter((it) => !archivedIds.has(it?.id) && it?.replied_at).length
  }, [inboxTabCounts?.replied, items, archivedIds])

  const { visibleItems, inboxCount, archiveCount } = useMemo(() => {
    const arr = Array.isArray(items) ? items : []
    let a = 0
    let i = 0
    for (const it of arr) {
      if (archivedIds.has(it?.id)) {
        a += 1
        continue
      }
      if (!it?.replied_at) i += 1
    }
    const filtered = arr.filter((it) => {
      const archived = archivedIds.has(it?.id)
      const replied = Boolean(it?.replied_at)
      if (folder === 'archive') return archived
      // Server already scopes replied tab; keep a client guard for consistency.
      if (listTab === 'replied') return !archived && replied
      return !archived && !replied
    })
    return { visibleItems: filtered, inboxCount: i, archiveCount: a }
  }, [items, archivedIds, folder, listTab])

  const sortedVisibleItems = useMemo(() => {
    let arr = visibleItems
    if (activeQuickFilter === 'high_priority') {
      arr = arr.filter(isHighPriority)
    }
    if (activeQuickFilter === 'needs_response') {
      arr = arr.filter(needsResponse)
    }
    if (activeQuickFilter === 'unread') {
      arr = arr.filter((it) => {
        const id = normFeedbackId(it?.id)
        return id != null && !readIds.has(id)
      })
    }
    if (activeQuickFilter === 'new') {
      arr = arr.filter((it) => isNewFeedback(it))
    }
    return sortInboxItems(arr, sortBy, pinnedIds)
  }, [visibleItems, activeQuickFilter, readIds, sortBy, pinnedIds])

  const displayedItems = sortedVisibleItems

  const inboxItemsForStats = useMemo(() => {
    const arr = Array.isArray(items) ? items : []
    return arr.filter((it) => !archivedIds.has(it?.id) && !it?.replied_at)
  }, [items, archivedIds])

  const totalInboxCount = useMemo(() => {
    const tabs = inboxTabCounts?.all
    if (Number.isFinite(tabs) && tabs >= 0) return tabs
    const server = Number(counts?.all)
    if (Number.isFinite(server) && server >= 0) return server
    return inboxCount
  }, [inboxTabCounts?.all, counts?.all, inboxCount])

  const unreadInboxCount = useMemo(() => {
    const tabs = inboxTabCounts?.unread
    if (Number.isFinite(tabs) && tabs >= 0) return tabs
    return computeStableUnreadCount({
      total: counts?.all,
      scopedIds: scopedInboxIds,
      readIds,
      loadedItems: inboxItemsForStats,
    })
  }, [inboxTabCounts?.unread, counts?.all, scopedInboxIds, readIds, inboxItemsForStats])

  const readInboxCount = useMemo(() => {
    const tabs = inboxTabCounts?.read
    if (Number.isFinite(tabs) && tabs >= 0) return tabs
    const total = totalInboxCount
    const unread = unreadInboxCount
    if (Number.isFinite(total) && total >= unread) return total - unread
    return inboxItemsForStats.filter((it) => {
      const id = normFeedbackId(it?.id)
      return id != null && readIds.has(id)
    }).length
  }, [inboxTabCounts?.read, totalInboxCount, unreadInboxCount, inboxItemsForStats, readIds])

  const tabTotal = useMemo(() => {
    if (listTab === 'read') return readInboxCount
    if (listTab === 'unread') return unreadInboxCount
    if (listTab === 'replied') return repliedCount
    return totalInboxCount
  }, [listTab, readInboxCount, unreadInboxCount, repliedCount, totalInboxCount])

  const paginationTotal = Number.isFinite(feedTotal) && feedTotal > 0 ? feedTotal : tabTotal
  const totalPages = Math.max(1, Math.ceil(Math.max(paginationTotal, 0) / pageSize) || 1)
  const pageStart = paginationTotal === 0 ? 0 : (page - 1) * pageSize + 1
  const pageEnd = Math.min(page * pageSize, paginationTotal)

  // Clamp page if totals shrink (e.g. after filters).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  // Sidebar mirrors the list on screen so tab, folder, quick filters and
  // server filters all shape the summary, themes and open activity.
  const sidebarStats = useMemo(
    () =>
      computeInboxStats(sortedVisibleItems, {
        readIds,
        folder,
      }),
    [sortedVisibleItems, readIds, folder],
  )

  const topThemes = useMemo(() => computeTopThemes(sortedVisibleItems, 0), [sortedVisibleItems])

  const sidebarScopeIds = useMemo(
    () => sortedVisibleItems.map((it) => normFeedbackId(it?.id)).filter(Boolean),
    [sortedVisibleItems],
  )

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const toggleSelected = useCallback((id) => {
    const fid = normFeedbackId(id)
    if (!fid) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(fid)) next.delete(fid)
      else next.add(fid)
      return next
    })
  }, [])

  const displayedIds = useMemo(
    () => displayedItems.map((it) => normFeedbackId(it?.id)).filter(Boolean),
    [displayedItems],
  )

  const allDisplayedSelected = useMemo(() => {
    if (!displayedIds.length) return false
    return displayedIds.every((id) => selectedIds.has(id))
  }, [displayedIds, selectedIds])

  const toggleSelectAllDisplayed = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const shouldSelect = !displayedIds.every((id) => next.has(id))
      for (const id of displayedIds) {
        if (shouldSelect) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }, [displayedIds])

  const markSelectedRead = useCallback(() => {
    const ids = Array.from(selectedIds)
    markIdsRead(ids)
    clearSelection()
  }, [selectedIds, markIdsRead, clearSelection])

  const markSelectedUnread = useCallback(() => {
    const ids = Array.from(selectedIds)
    markIdsUnread(ids)
    clearSelection()
  }, [selectedIds, markIdsUnread, clearSelection])

  const pinSelected = useCallback(() => {
    setPinnedMany(Array.from(selectedIds), true)
    clearSelection()
  }, [selectedIds, setPinnedMany, clearSelection])

  const unpinSelected = useCallback(() => {
    setPinnedMany(Array.from(selectedIds), false)
    clearSelection()
  }, [selectedIds, setPinnedMany, clearSelection])

  const handleQuickFilter = useCallback((id) => {
    if (id === 'clear') {
      setActiveQuickFilter(null)
      return
    }
    if (id === 'negative_7d') {
      setSentiment('negative')
      setDateRange('7d')
      setActiveQuickFilter('negative_7d')
      return
    }
    setActiveQuickFilter(id)
    if (id === 'unread') setListTab('unread')
    if (id === 'new') {
      setListTab('all')
      setDateRange('today')
    }
  }, [])

  useEffect(() => {
    if (!openItem?.id) {
      setOpenReaders(null)
      return undefined
    }
    let cancelled = false
    setOpenReaders(null)
    ;(async () => {
      try {
        const data = await getFeedbackOpenReaders(openItem.id)
        if (!cancelled) setOpenReaders(data)
      } catch {
        if (!cancelled) setOpenReaders(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [openItem?.id])

  useEffect(() => {
    if (!openItem?.id || channelKind(openItem) !== 'whatsapp') {
      setWhatsappThread(null)
      return undefined
    }
    let cancelled = false
    getWhatsAppThread(openItem.id)
      .then((data) => {
        if (!cancelled) setWhatsappThread(data?.messages || [])
      })
      .catch(() => {
        if (!cancelled) setWhatsappThread(null)
      })
    return () => {
      cancelled = true
    }
  }, [openItem?.id])

  visibleItemsRef.current = sortedVisibleItems

  useEffect(() => {
    setListHighlightId(null)
  }, [source, sentiment, q, insuranceTagFilter, locationFilter, dateParams, folder, peakDow, peakHour, peakRangeDays])

  /** Power-user list navigation: J/K move, Enter opens (skipped inside inputs / when modal open). */
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (openItem) return
      if (!sortedVisibleItems.length) return
      const ids = sortedVisibleItems.map((x) => x.id)
      const cur = listHighlightRef.current
      let idx = cur != null ? ids.indexOf(cur) : -1

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        const next = idx < 0 ? 0 : Math.min(idx + 1, ids.length - 1)
        const nid = ids[next]
        setListHighlightId(nid)
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
        const it = sortedVisibleItems.find((x) => x.id === id)
        if (it) openFeedback(it)
      }
      if (e.key === 'Escape') {
        setListHighlightId(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [sortedVisibleItems, openItem, openFeedback])

  const goToPage = useCallback(
    (next) => {
      const n = Number(next)
      if (!Number.isFinite(n)) return
      setPage(Math.min(Math.max(1, Math.floor(n)), totalPages))
    },
    [totalPages],
  )

  const scrollInboxToTop = useCallback((opts = {}) => {
    if (typeof window === 'undefined') return
    const smooth = Boolean(opts.smooth)
    const behavior = smooth ? 'smooth' : 'auto'
    // The app shell scrolls inside <main>, not the window.
    const main = document.querySelector('main')
    if (main) {
      if (typeof main.scrollTo === 'function') main.scrollTo({ top: 0, behavior })
      else main.scrollTop = 0
    }
    if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior })
    else window.scrollTo(0, 0)
    const el = inboxTopRef.current
    if (el) {
      try {
        el.scrollIntoView({ block: 'start', behavior })
      } catch {
        // ignore
      }
    }
  }, [])

  // Scroll as soon as page/tab/filters change…
  useLayoutEffect(() => {
    scrollInboxToTop()
  }, [page, listTab, pageSize, filterKey, scrollInboxToTop])

  // …and again after the feed settles (DOM height changes cancel earlier scrolls).
  useLayoutEffect(() => {
    if (loading || pageLoading) return undefined
    scrollInboxToTop()
    const t = window.setTimeout(() => scrollInboxToTop(), 0)
    return () => window.clearTimeout(t)
  }, [loading, pageLoading, items, page, listTab, scrollInboxToTop])

  return (
    <div ref={inboxTopRef} className="scroll-mt-4 p-4 sm:p-6 lg:p-8 space-y-5">
      <InboxPageIntro />

      <InboxFilterToolbar
        searchDraft={qDraft}
        onSearchDraftChange={setQDraft}
        onSearchSubmit={() => setQ(qDraft.trim())}
        searchInputRef={searchInputRef}
        sentiment={sentiment}
        onSentimentChange={setSentiment}
        sentimentOptions={sentimentOptions}
        source={source}
        onSourceChange={setChannelSource}
        sourceTabs={sourceTabs}
        counts={counts}
        selectedSourceLabel={selectedSourceLabel}
        selectedSourceCount={selectedSourceCount}
        formatSourceLabel={formatSourceLabel}
        SourceIcon={SourceIcon}
        insuranceTagFilter={insuranceTagFilter}
        onInsuranceTagChange={setInsuranceTagFilter}
        themeOptions={themeOptions}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        dateRangeOptions={dateRangeOptions}
        folder={folder}
        onFolderChange={(next) => {
          setFolder(next)
          if (next === 'archive' && listTab === 'replied') setListTab('all')
        }}
        inboxCount={Math.max(inboxCount, totalInboxCount - repliedCount)}
        archiveCount={archiveCount}
      />

      <div className="space-y-3">
          {peakDow != null && peakHour != null && (
            <button
              type="button"
              onClick={() => {
                setPeakDow(null)
                setPeakHour(null)
                setPeakRangeDays(null)
              }}
              className="inline-flex w-full sm:w-auto min-h-[44px] items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/50"
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
              className="inline-flex w-full sm:w-auto min-h-[44px] max-w-full sm:max-w-[16rem] items-center justify-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/50"
              title="Clear location filter"
            >
              <span className="min-w-0 truncate">Location: {locationFilter.trim()}</span>
              <span className="text-amber-800/80 dark:text-amber-200/70">×</span>
            </button>
          ) : null}

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
            onClick={() => load({ append: false })}
            className="inline-flex shrink-0 min-h-[44px] items-center justify-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
          >
            <FiRefreshCw className="h-4 w-4" aria-hidden />
            Retry
          </button>
        </div>
      )}
      <div className="flex gap-6">
        <div className="min-w-0 flex-1 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:p-5">
          <InboxListPanel
            loading={loading}
            error={error}
            listTab={listTab}
            onListTabChange={(tab) => {
              setListTab(tab)
              setPage(1)
              if (tab === 'replied' && folder === 'archive') setFolder('inbox')
            }}
            allCount={totalInboxCount}
            readCount={readInboxCount}
            unreadCount={unreadInboxCount}
            repliedCount={repliedCount}
            sortBy={sortBy}
            onSortChange={(v) => {
              setSortBy(v)
              setPage(1)
            }}
            displayedItems={displayedItems}
            listHighlightId={listHighlightId}
            highlightTheme={insuranceTagFilter}
            pageLoading={pageLoading}
            selectedIds={selectedIds}
            selectedCount={selectedIds.size}
            readIds={readIds}
            pinnedIds={pinnedIds}
            archivedIds={archivedIds}
            allDisplayedSelected={allDisplayedSelected}
            onToggleSelectAll={toggleSelectAllDisplayed}
            onClearSelection={clearSelection}
            onMarkSelectedRead={markSelectedRead}
            onMarkSelectedUnread={markSelectedUnread}
            onPinSelected={pinSelected}
            onUnpinSelected={unpinSelected}
            onOpenItem={openFeedback}
            onToggleSelected={toggleSelected}
            onTogglePinned={togglePinned}
            onArchiveToggle={(id) => {
              setArchivedIds((prev) => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }}
            onToggleReplied={async (id) => {
              const item = (itemsRef.current || []).find((it) => it?.id === id)
              const nextReplied = !item?.replied_at
              try {
                const data = await markFeedbackReplied(id, { replied: nextReplied })
                const repliedAt = nextReplied ? data?.replied_at || new Date().toISOString() : null
                setItems((prev) =>
                  (Array.isArray(prev) ? prev : []).map((it) =>
                    it?.id === id ? { ...it, replied_at: repliedAt } : it,
                  ),
                )
              } catch (err) {
                console.error('Failed to mark replied', err)
              }
            }}
            formatRelativeTime={formatRelativeTime}
            SourceIcon={SourceIcon}
            page={page}
            pageSize={pageSize}
            pageSizeOptions={INBOX_PAGE_SIZE_OPTIONS}
            totalPages={totalPages}
            pageStart={pageStart}
            pageEnd={pageEnd}
            paginationTotal={paginationTotal}
            hasNextPage={feedHasMore || page < totalPages}
            onPageChange={goToPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            onScrollToTop={() => scrollInboxToTop({ smooth: true })}
            onClearFilters={() => {
              setQDraft('')
              setQ('')
              setSource('all')
              setSentiment('all')
              setInsuranceTagFilter('all')
              setDateRange('all')
              setActiveQuickFilter(null)
              setListTab('all')
              setPage(1)
            }}
          />
        </div>

        <InboxSidebar
          items={sortedVisibleItems}
          scopeIds={sidebarScopeIds}
          stats={sidebarStats}
          topThemes={topThemes}
          activeQuickFilter={activeQuickFilter}
          onQuickFilter={handleQuickFilter}
          onSelectTheme={(key) => setInsuranceTagFilter(key || 'all')}
          activeTheme={insuranceTagFilter}
        />
      </div>

      {/** WhatsApp-style read ticks (brand green) */}
      {/*
        Rendered inside each card (absolute bottom-right) so it matches the reference:
        two ticks, slightly offset, thicker stroke, rounded ends.
      */}

      {openItem && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
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
            className="w-full max-w-2xl h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[85vh] flex flex-col overflow-hidden rounded-none sm:rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 z-10 border-b border-gray-100 bg-white px-4 sm:px-5 py-4 dark:border-gray-800 dark:bg-gray-950">
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
                      title={canViewCustomer ? 'View customer' : 'No customer identity found for this feedback yet'}
                      className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px] items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/50"
                    >
                      <FiEye className="h-5 w-5" aria-hidden />
                    </button>
                  )
                })()}
                {(() => {
                  const fid = normFeedbackId(openItem?.id)
                  const isRead = fid != null && readIds.has(fid)
                  const isPinned = fid != null && pinnedIds.has(fid)
                  return (
                    <>
                      {isRead ? (
                        <button
                          type="button"
                          onClick={() => fid && markIdsUnread([fid])}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                          title="Mark as unread"
                        >
                          <FiMail className="h-4 w-4" aria-hidden />
                          Unread
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => fid && togglePinned(fid)}
                        className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border px-2 py-2 ${
                          isPinned
                            ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
                        }`}
                        title={isPinned ? 'Unpin' : 'Pin'}
                        aria-label={isPinned ? 'Unpin feedback' : 'Pin feedback'}
                      >
                        <FiBookmark className="h-5 w-5" aria-hidden />
                      </button>
                    </>
                  )
                })()}
                <button
                  type="button"
                  onClick={() => setOpenItem(null)}
                  aria-label="Close"
                  title="Close"
                  className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px] items-center justify-center rounded-lg border border-gray-200 bg-white px-2 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <FiX className="h-5 w-5" aria-hidden />
                </button>
              </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 sm:px-5 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:pb-5">
            <div className="flex flex-wrap items-center gap-2">
              <SentimentPill label={openItem.sentiment_label} />
              <SentimentCorrectControl
                feedbackId={openItem.id}
                currentLabel={openItem.sentiment_label}
                onCorrected={(res) => {
                  const nextLabel = res?.sentiment_label
                  const nextScore = res?.sentiment_score
                  const nextPriority = res?.priority
                  const patch = (it) =>
                    it?.id === openItem.id
                      ? {
                          ...it,
                          sentiment_label: nextLabel ?? it.sentiment_label,
                          sentiment_score: nextScore ?? it.sentiment_score,
                          priority: nextPriority ?? it.priority,
                          sentiment_override: res?.sentiment_override ?? it.sentiment_override,
                          sentiment_review: res?.sentiment_review ?? it.sentiment_review,
                        }
                      : it
                  setOpenItem((prev) => (prev ? patch(prev) : prev))
                  setItems((prev) => (Array.isArray(prev) ? prev.map(patch) : prev))
                }}
              />
              <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                {String(
                  openItem.channel_label ||
                    openItem.channel_metadata?.channel_label ||
                    openItem.channel_metadata?.mailbox_label ||
                    openItem.source_group ||
                    openItem.source ||
                    'source',
                ).replace(/_/g, ' ')}
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
                                  String(m.policy_masked).includes('(name match)') ? (
                                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                                      Plan name match
                                    </span>
                                  ) : (
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{m.policy_masked}</span>
                                  )
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
                </div>
              </div>

            <div className="mt-4">
              <ChannelMessageView
                item={openItem}
                whatsappThread={whatsappThread}
                renderLinkedText={renderLinkedText}
              />
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
                          key={`media-${idx}-${type}`}
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
                          key={`media-${idx}-${type}`}
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
                          key={`media-${idx}-${type}`}
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
              {(() => {
                const label = String(openItem.customer_label || openItem.customer_id || '').trim()
                const meta = openItem.channel_metadata && typeof openItem.channel_metadata === 'object' ? openItem.channel_metadata : {}
                const phone = String(meta.phone || meta.from_number || '').trim()
                if (phone && !phone.startsWith('*')) return phone
                if (label && !label.startsWith('*')) return label
                return 'Unknown customer'
              })()}
            </p>

            {openReaders && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-3 dark:border-gray-800 dark:bg-gray-900/40">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Opened by ({openReaders.opened_count || 0})
                </h3>
                {(openReaders.readers || []).length === 0 ? (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">No one else has opened this yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {(openReaders.readers || []).map((r) => (
                      <li key={r.user_id} className="flex items-center justify-between gap-2 text-xs text-gray-700 dark:text-gray-200">
                        <span className="min-w-0 truncate font-medium" title={r.email || ''}>
                          {String(r.full_name || '').trim() || r.email || `User #${r.user_id}`}
                        </span>
                        <span className="shrink-0 text-gray-500 dark:text-gray-400">
                          {r.opened_at ? formatRelativeTime(r.opened_at) : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

