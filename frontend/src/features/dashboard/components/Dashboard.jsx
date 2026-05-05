import { useState, useEffect, useMemo, useRef } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts'
import {
  FiThumbsUp,
  FiThumbsDown,
  FiAlertTriangle,
  FiArrowLeft,
  FiFlag,
  FiCheckCircle,
  FiArchive,
  FiUserPlus,
  FiMail,
  FiX,
  FiDownload,
  FiClock,
  FiSliders,
  FiInbox,
  FiUploadCloud,
  FiLink2,
  FiRefreshCw,
  FiInfo,
  FiCalendar,
  FiBarChart2,
  FiMinus,
} from 'react-icons/fi'
import {
  getAnalytics,
  getRecentFeedback,
  getPriorityQueue,
  getProductPulse,
  getProductPulseTrend,
} from '../services/dashboard.api'
import { getBackendOrigin, getClipboardBackendOrigin, USE_DEV_API_PROXY } from '../../../shared/lib/apiClient'
import { getSourceCounts } from '../../inbox/services/inbox.api'
import { VIRIDIS, SENTIMENT_COLORS, CHART_PALETTE } from '../constants/palette'
import {
  formatInsuranceTagChartLabel,
  formatRelativeTime,
  formatSentimentWord,
} from '../utils/dashboardFormatters'
import { SourceLogo, SourcePill } from './SourceIndicators'
import EmptyState from './EmptyState'
import { DEFAULT_INBOX_PRESET, DASHBOARD_AUTO_REFRESH_KEY } from '../constants/dashboardConfig'
import { normalizeRoleKey, getPeakHeatmapCellStyles } from '../utils/dashboardRole'
import { safeParseJson, computeManagementInsights } from '../utils/dashboardHelpers'
import { buildSourceTrendColorMap } from '../utils/dashboardCharts'
import OverviewMetricCards from './OverviewMetricCards'
import OverviewChartsSection from './OverviewChartsSection'
import OverviewWordCloudAndSource from './OverviewWordCloudAndSource'

function Dashboard({
  mode = 'overview',
  onNavigateToInbox,
  inboxPreset = DEFAULT_INBOX_PRESET,
  userRole,
  isAdminUser = false,
  onNavigateToInsights,
  onNavigateBack,
  onNavigateScheduleReport,
  onNavigateCustomReport,
}) {
  const isDarkMode =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  const onKpiPointerEnter = (key) => (e) => {
    if (e?.pointerType === 'mouse') setActiveKpiChange(key)
  }
  const onKpiPointerLeave = () => (e) => {
    if (e?.pointerType === 'mouse') setActiveKpiChange(null)
  }

  const [metrics, setMetrics] = useState({
    totalFeedback: 0,
    positive: 0,
    negative: 0,
    neutral: 0,
    highPriority: 0,
  })
  const [sentimentData, setSentimentData] = useState([])
  const [categoryData, setCategoryData] = useState([])
  const [recentFeedback, setRecentFeedback] = useState([])
  const [priorityQueue, setPriorityQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [inboxLoading, setInboxLoading] = useState(true)
  const [analyticsDelayPassed, setAnalyticsDelayPassed] = useState(false)
  const [inboxDelayPassed, setInboxDelayPassed] = useState(false)
  // Schedule/custom report now live as dedicated pages.
  const [scheduleFrequency, setScheduleFrequency] = useState('daily')
  const [scheduleTime, setScheduleTime] = useState('08:00')
  const [trendData, setTrendData] = useState([])
  const [comparison, setComparison] = useState({ this_week: null, last_week: null })
  const [responseMetrics, setResponseMetrics] = useState(null)
  const [peakTimes, setPeakTimes] = useState([])
  const [scoreHistogram, setScoreHistogram] = useState([])
  const [categoryTrends, setCategoryTrends] = useState([])
  const [productPulse, setProductPulse] = useState([])
  const [productPulseTrends, setProductPulseTrends] = useState([])
  const [insuranceTagsBreakdown, setInsuranceTagsBreakdown] = useState({})
  const [insuranceTagsTrends, setInsuranceTagsTrends] = useState([])
  const [sourceTrends, setSourceTrends] = useState({ sources: [], data: [] })
  const [sourcePerformance, setSourcePerformance] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sentimentFilter, setSentimentFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [dateRange, setDateRange] = useState('all') // all | 7d | 30d | custom
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [statusById, setStatusById] = useState({})
  const [reactionsById, setReactionsById] = useState({})
  const [selectedFeedback, setSelectedFeedback] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [unreadPriorityIds, setUnreadPriorityIds] = useState(new Set())
  const [unreadRecentIds, setUnreadRecentIds] = useState(new Set())
  const [toasts, setToasts] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const overviewRole = normalizeRoleKey(userRole) // management | cx | operations
  const isManagement = overviewRole === 'management'
  const isCx = overviewRole === 'cx'
  const isOperations = overviewRole === 'operations'
  const showSourceChart = !isOperations
  const showWordCloudSection = !isCx
  const sourceAndWordcloudSideBySide = showSourceChart && showWordCloudSection
  const reloadDashboardRef = useRef(() => {})
  /** Silent refetch (no full-page spinners) — used for optional polling + live SSE. */
  const refreshDashboardSilentRef = useRef(() => {})
  const analyticsSseDebounceRef = useRef(null)
  /** When true, admins have enabled 30s polling and analytics refresh on SSE. */
  const [dashboardAutoRefresh, setDashboardAutoRefresh] = useState(false)
  const dashboardAutoRefreshRef = useRef(false)

  useEffect(() => {
    if (!isAdminUser) {
      setDashboardAutoRefresh(false)
      return
    }
    try {
      const s = localStorage.getItem(DASHBOARD_AUTO_REFRESH_KEY)
      setDashboardAutoRefresh(s === '1' || s === 'true')
    } catch {
      // ignore
    }
  }, [isAdminUser])

  useEffect(() => {
    dashboardAutoRefreshRef.current = isAdminUser && dashboardAutoRefresh
  }, [isAdminUser, dashboardAutoRefresh])
  const analyticsDataRef = useRef(null)
  const [activeKpiChange, setActiveKpiChange] = useState(null)
  const [serverSourceCounts, setServerSourceCounts] = useState(null)
  const [insightsRange, setInsightsRange] = useState(30) // Insights (all cards): 7/30/90
  /** `prefix|group` from product pulse (empty = all products) */
  const [insightsProductKey, setInsightsProductKey] = useState('')
  const [insightsProductOptions, setInsightsProductOptions] = useState(() => [])
  /** Overview dashboard time scope: matches GET /api/analytics?time_window= */
  const [overviewTimeFilter, setOverviewTimeFilter] = useState('all') // all | today | week | month

  const insightsProductParams = useMemo(() => {
    if (!insightsProductKey) return {}
    const i = insightsProductKey.indexOf('|')
    const prefix = i >= 0 ? insightsProductKey.slice(0, i) : insightsProductKey
    const group = i >= 0 ? insightsProductKey.slice(i + 1) : ''
    if (!String(prefix).trim()) return {}
    return { product_prefix: String(prefix).trim(), product_group: group }
  }, [insightsProductKey])

  useEffect(() => {
    if (mode !== 'insights') {
      setInsightsProductOptions([])
      setInsightsProductKey('')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const pulse = await getProductPulse({ range_days: insightsRange })
        if (cancelled) return
        const items = Array.isArray(pulse?.items) ? pulse.items : []
        const opts = items
          .map((r) => {
            const prefix = String(r.product_prefix || '').trim()
            const rawG = r.product_group
            const group = rawG == null ? '' : String(rawG)
            const key = `${prefix}|${group}`
            const g = group.trim()
            const p = prefix
            const label = g && p ? `${g} (${p})` : g || p || 'Unknown'
            return { key, label }
          })
          .filter((o) => o.key !== '|')
          .sort((a, b) => String(a.label).localeCompare(String(b.label)))
        setInsightsProductOptions(opts)
      } catch {
        if (!cancelled) setInsightsProductOptions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode, insightsRange])

  useEffect(() => {
    if (!insightsProductKey) return
    if (!insightsProductOptions.some((o) => o.key === insightsProductKey)) {
      setInsightsProductKey('')
    }
  }, [insightsProductOptions, insightsProductKey])

  const [heatmapHover, setHeatmapHover] = useState(null)

  /** Subtitle/empty copy for the overview Insurance tags chart (aligns with API window). */
  const overviewInsuranceTagsCaption = useMemo(() => {
    switch (overviewTimeFilter) {
      case 'today':
        return {
          subtitle: 'Counts from today',
          empty: 'No insurance tags for the selected period.',
        }
      case 'week':
        return {
          subtitle: 'Counts from the last 7 days',
          empty: 'No insurance tags for the selected period.',
        }
      case 'month':
        return {
          subtitle: 'Counts this calendar month',
          empty: 'No insurance tags for the selected period.',
        }
      case 'all':
      default:
        return {
          subtitle: 'Counts from the last 30 days (rolling window)',
          empty: 'No insurance tags for the selected period.',
        }
    }
  }, [overviewTimeFilter])

  /** Share of total feedback for KPI bottom track (0–100). */
  const kpiTrackPercent = useMemo(() => {
    const d = Math.max(Number(metrics.totalFeedback) || 0, 1)
    const clamp = (n) => Math.min(100, Math.max(0, n))
    return {
      total: 100,
      negative: clamp(((Number(metrics.negative) || 0) / d) * 100),
      positive: clamp(((Number(metrics.positive) || 0) / d) * 100),
      neutral: clamp(((Number(metrics.neutral) || 0) / d) * 100),
      highPriority: clamp(((Number(metrics.highPriority) || 0) / d) * 100),
    }
  }, [metrics])

  const pushToast = (title, message, variant = 'info') => {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), title, message, variant }])
  }

  const { trendYMax, trendAllZero } = useMemo(() => {
    const max = trendData.reduce((m, t) => {
      const p = Number(t.positive) || 0
      const n = Number(t.neutral) || 0
      const g = Number(t.negative) || 0
      return Math.max(m, p, n, g)
    }, 0)
    return {
      trendYMax: max === 0 ? 1 : Math.ceil(max * 1.15),
      trendAllZero: trendData.length > 0 && max === 0,
    }
  }, [trendData])

  useEffect(() => {
    // Ensure skeletons are visible for at least 600ms
    const analyticsTimer = setTimeout(() => setAnalyticsDelayPassed(true), 600)
    const inboxTimer = setTimeout(() => setInboxDelayPassed(true), 600)

    return () => {
      clearTimeout(analyticsTimer)
      clearTimeout(inboxTimer)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'inbox') return
    const s = inboxPreset?.sentiment ?? 'all'
    const p = inboxPreset?.priority ?? 'all'
    setSentimentFilter(s)
    setPriorityFilter(p)
  }, [mode, inboxPreset?.sentiment, inboxPreset?.priority])

  useEffect(() => {
    if (mode !== 'inbox') return
    let cancelled = false

    const computeDates = () => {
      if (dateRange === 'custom') {
        return {
          date_from: customDateFrom || undefined,
          date_to: customDateTo || undefined,
        }
      }
      if (dateRange === '7d' || dateRange === '30d') {
        const days = dateRange === '7d' ? 7 : 30
        const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        return { date_from: from.toISOString(), date_to: undefined }
      }
      return { date_from: undefined, date_to: undefined }
    }

    ;(async () => {
      try {
        const { date_from, date_to } = computeDates()
        const data = await getSourceCounts({
          sentiment: sentimentFilter,
          category: categoryFilter === 'all' ? undefined : categoryFilter,
          priority: priorityFilter === 'high' ? 'high' : 'all',
          date_from,
          date_to,
        })
        if (!cancelled) setServerSourceCounts(data)
      } catch {
        if (!cancelled) setServerSourceCounts(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [mode, sentimentFilter, categoryFilter, priorityFilter, dateRange, customDateFrom, customDateTo])

  const navigateToInboxPreset = ({ sentiment, priority }) => {
    onNavigateToInbox?.({
      sentiment: sentiment || 'all',
      priority: priority || 'all',
    })
  }

  const kpiRelatedAlerts = (kpiKey) => {
    const alerts = Array.isArray(managementInsights?.alerts) ? managementInsights.alerts : []
    if (!alerts.length) return []
    // Show sentiment-specific alerts only on their corresponding KPI.
    if (kpiKey === 'negative') return alerts.filter((a) => a.id === 'neg_share_spike' || a.id === 'hp_age')
    if (kpiKey === 'positive')
      return alerts.filter(
        (a) =>
          a.id === 'pos_share_spike' ||
          a.id === 'pos_share_drop' ||
          a.id === 'pos_volume_spike' ||
          a.id === 'pos_volume_drop',
      )
    return []
  }

  // Note: we intentionally do not auto-close KPI popovers on global clicks/taps,
  // because mobile taps can otherwise close the popover before it becomes visible.
  // Popovers close on mouse-leave / blur, or on second-tap (which triggers navigation).

  const managementInsights = useMemo(() => {
    const unknownCount = Number((analyticsDataRef?.current?.sentiment?.unknown ?? 0) || 0)
    return computeManagementInsights({
      mode,
      overviewTimeFilter,
      comparison,
      highPriority: metrics?.highPriority,
      responseMetrics,
      unknownSentimentCount: unknownCount,
    })
  }, [mode, overviewTimeFilter, comparison, metrics?.highPriority, responseMetrics])

  const sourceTrendColors = useMemo(() => buildSourceTrendColorMap(sourceTrends), [sourceTrends])

  useEffect(() => {
    let cancelled = false

    const fetchData = async (isSilent = false) => {
      if (!isSilent) {
        setLoading(true)
        setAnalyticsLoading(true)
        setInboxLoading(true)
      }

      try {
        const analyticsData =
          mode === 'insights'
            ? await getAnalytics({ range_days: insightsRange, ...insightsProductParams })
            : mode === 'overview'
              ? await getAnalytics({ time_window: overviewTimeFilter })
              : await getAnalytics()
        if (cancelled) return
        analyticsDataRef.current = analyticsData

        if (analyticsData.metrics) {
          setMetrics({
            totalFeedback: analyticsData.metrics.total_feedback || 0,
            positive: analyticsData.metrics.positive_count || 0,
            negative: analyticsData.metrics.negative_count || 0,
            neutral: analyticsData.metrics.neutral_count || 0,
            highPriority: analyticsData.metrics.high_priority_count || 0,
          })
        }

        const sentiment = analyticsData.sentiment || {}
        const sentimentChartData = []
        if (sentiment.positive && sentiment.positive > 0) {
          sentimentChartData.push({
            name: 'Positive',
            value: Number(sentiment.positive),
            color: SENTIMENT_COLORS.Positive,
          })
        }
        if (sentiment.negative && sentiment.negative > 0) {
          sentimentChartData.push({
            name: 'Negative',
            value: Number(sentiment.negative),
            color: SENTIMENT_COLORS.Negative,
          })
        }
        if (sentiment.neutral && sentiment.neutral > 0) {
          sentimentChartData.push({
            name: 'Neutral',
            value: Number(sentiment.neutral),
            color: SENTIMENT_COLORS.Neutral,
          })
        }
        if (sentimentChartData.length === 0) {
          sentimentChartData.push({
            name: 'No Data',
            value: 1,
            color: SENTIMENT_COLORS['No Data'],
          })
        }
        setSentimentData(sentimentChartData)

        const categories = analyticsData.categories || {}
        const categoryChartData = Object.entries(categories)
          .map(([name, value]) => ({
            name,
            value: Number(value),
          }))
          .sort((a, b) => b.value - a.value)
          .map((row, i) => ({
            ...row,
            fill: CHART_PALETTE[i % CHART_PALETTE.length],
          }))
        setCategoryData(
          categoryChartData.length > 0
            ? categoryChartData
            : [{ name: 'No data', value: 0, fill: '#eef8f4' }],
        )

        setTrendData(analyticsData.trends || [])
        setComparison(
          analyticsData.period_comparison || { this_week: null, last_week: null },
        )
        setResponseMetrics(analyticsData.response_metrics || null)
        setPeakTimes(analyticsData.peak_times || [])

        const rawHistogram = analyticsData.score_histogram || []
        const bucketLabelMap = {
          very_negative: 'Very negative',
          negative: 'Negative',
          neutral: 'Neutral',
          positive: 'Positive',
          very_positive: 'Very positive',
        }
        setScoreHistogram(
          rawHistogram.map((item) => ({
            ...item,
            label: bucketLabelMap[item.bucket] || item.bucket,
          })),
        )
        setCategoryTrends(analyticsData.category_trends || [])
        setSourceTrends(
          analyticsData.source_trends && typeof analyticsData.source_trends === 'object'
            ? {
                sources: Array.isArray(analyticsData.source_trends.sources)
                  ? analyticsData.source_trends.sources
                  : [],
                data: Array.isArray(analyticsData.source_trends.data)
                  ? analyticsData.source_trends.data
                  : [],
              }
            : { sources: [], data: [] },
        )
        setSourcePerformance(analyticsData.source_performance || [])
        setInsuranceTagsBreakdown(
          analyticsData.insurance_tags_breakdown && typeof analyticsData.insurance_tags_breakdown === 'object'
            ? analyticsData.insurance_tags_breakdown
            : {}
        )
        setInsuranceTagsTrends(Array.isArray(analyticsData.insurance_tags_trends) ? analyticsData.insurance_tags_trends : [])

        if (mode === 'overview' || mode === 'insights') {
          const rangeDays =
            mode === 'insights'
              ? insightsRange
              : overviewTimeFilter === 'today'
                ? 1
                : overviewTimeFilter === 'week'
                  ? 7
                  : overviewTimeFilter === 'month'
                    ? 30
                    : 30
          const pulseParams =
            mode === 'insights' ? { range_days: rangeDays, ...insightsProductParams } : { range_days: rangeDays }
          const pulse = await getProductPulse(pulseParams).catch(() => ({ items: [] }))
          if (!cancelled) {
            const items = Array.isArray(pulse?.items) ? pulse.items : []
            setProductPulse(
              items.slice(0, 12).map((r) => ({
                name: r.product_group || r.product_prefix || 'Unknown',
                total: Number(r.total || 0),
              })),
            )
          }
        } else {
          setProductPulse([])
        }

        if (mode === 'insights') {
          const pt = await getProductPulseTrend({
            range_days: insightsRange,
            top_n: 6,
            ...insightsProductParams,
          }).catch(() => ({
            trends: [],
          }))
          if (!cancelled) {
            setProductPulseTrends(Array.isArray(pt?.trends) ? pt.trends : [])
          }
        } else if (!cancelled) {
          setProductPulseTrends([])
        }

        if (!isSilent) {
          setAnalyticsLoading(false)
        }

        const [recentData, priorityData] = await Promise.all([
          getRecentFeedback(100).catch(() => ({ feedback: [] })),
          getPriorityQueue(50).catch(() => ({ feedback: [] })),
        ])
        if (cancelled) return

        setRecentFeedback(recentData.feedback || [])
        setPriorityQueue(priorityData.feedback || [])

        if (!isSilent) {
          setInboxLoading(false)
        }
        setError(null)
        setLastUpdated(new Date())
      } catch (err) {
        if (cancelled) return
        console.error('Error fetching analytics:', err)
        if (!isSilent) {
          setError(
            USE_DEV_API_PROXY
              ? 'Failed to load dashboard data. With dev proxy, Flask should listen on 127.0.0.1:5000 (see VITE_PROXY_TARGET in vite.config.js).'
              : `Failed to load dashboard data. Make sure Flask API is running on ${getClipboardBackendOrigin()}`
          )
          setSentimentData([{ name: 'Error', value: 1, color: '#d1d5db' }])
          setCategoryData([{ name: 'Error', value: 0 }])
          setRecentFeedback([])
          setPriorityQueue([])
          setProductPulseTrends([])
        }
      } finally {
        if (!cancelled && !isSilent) {
          setLoading(false)
          setAnalyticsLoading(false)
          setInboxLoading(false)
        }
      }
    }

    reloadDashboardRef.current = () => fetchData(false)
    refreshDashboardSilentRef.current = () => fetchData(true)

    fetchData(false)
    const allowInterval = isAdminUser && dashboardAutoRefresh
    const interval = allowInterval ? setInterval(() => fetchData(true), 30000) : null
    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
  }, [mode, insightsRange, overviewTimeFilter, isAdminUser, dashboardAutoRefresh, insightsProductParams])

  // Live updates via Server-Sent Events (SSE)
  useEffect(() => {
    const source = new EventSource(`${getBackendOrigin()}/api/events`, {
      withCredentials: false,
    })

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'feedback_created') {
          if (
            (mode === 'overview' || mode === 'insights') &&
            dashboardAutoRefreshRef.current
          ) {
            if (analyticsSseDebounceRef.current) {
              clearTimeout(analyticsSseDebounceRef.current)
            }
            analyticsSseDebounceRef.current = setTimeout(() => {
              refreshDashboardSilentRef.current?.()
            }, 500)
          }
          // Simple strategy: refresh inbox lists and show toast if high priority/negative
          ;(async () => {
            try {
              const [recentData, priorityData] = await Promise.all([
                getRecentFeedback(100).catch(() => ({ feedback: [] })),
                getPriorityQueue(50).catch(() => ({ feedback: [] })),
              ])
              setRecentFeedback(recentData.feedback || [])
              setPriorityQueue(priorityData.feedback || [])

              if (data.priority >= 100 || data.sentiment_label === 'negative') {
                setToasts((prev) => [
                  ...prev,
                  {
                    id: Date.now(),
                    title: 'New high-priority feedback',
                    message: `${data.source || 'Unknown channel'} · ${
                      data.category || 'Uncategorized'
                    }`,
                    variant: 'warning',
                  },
                ])

                if (data.priority >= 100) {
                  setUnreadPriorityIds((prev) => {
                    const next = new Set(prev)
                    next.add(data.id)
                    return next
                  })
                } else {
                  setUnreadRecentIds((prev) => {
                    const next = new Set(prev)
                    next.add(data.id)
                    return next
                  })
                }
              }
            } catch (err) {
              console.error('Failed to refresh inbox after SSE event', err)
            }
          })()
        }
      } catch (err) {
        console.error('Error handling SSE message', err)
      }
    }

    return () => {
      if (analyticsSseDebounceRef.current) {
        clearTimeout(analyticsSseDebounceRef.current)
      }
      source.close()
    }
  }, [mode])

  const allFeedback = [...recentFeedback, ...priorityQueue]
  const sourceOptions = Array.from(
    new Set(allFeedback.map((f) => f.source).filter(Boolean))
  ).sort()

  const canonicalSources = [
    'email',
    'web',
    'google_forms',
    'whatsapp',
    'x',
    'twitter',
    'tiktok',
    'instagram',
    'facebook',
  ]

  const normalizeSourceGroup = (value) => {
    const s = String(value || '').toLowerCase()
    if (!s) return ''
    if (s === 'email' || s.includes('mail')) return 'email'
    if (s === 'web' || s.startsWith('web_') || s.startsWith('web-') || s.includes('webform') || s.includes('web_form'))
      return 'web'
    if (s.includes('whatsapp')) return 'whatsapp'
    if (s === 'x' || s.includes('x_') || s.includes('x-') || s.includes('x ')) return 'x'
    if (s.includes('twitter')) return 'twitter'
    if (s.includes('tiktok')) return 'tiktok'
    if (s.includes('instagram')) return 'instagram'
    if (s.includes('facebook')) return 'facebook'
    return s
  }
  const sourceTabs = [
    ...canonicalSources,
    ...sourceOptions.map((s) => String(s).toLowerCase()),
  ]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort((a, b) => {
      const ai = canonicalSources.indexOf(a)
      const bi = canonicalSources.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  const categoryOptions = Array.from(
    new Set(allFeedback.map((f) => f.category).filter(Boolean))
  ).sort()

  const matchesDateRange = (createdAt) => {
    if (!createdAt) return true
    const created = new Date(createdAt)
    if (Number.isNaN(created.getTime())) return true

    const now = new Date()
    if (dateRange === '7d') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return created >= sevenDaysAgo
    }
    if (dateRange === '30d') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return created >= thirtyDaysAgo
    }
    if (dateRange === 'custom') {
      const fromOk = customDateFrom
        ? created >= new Date(customDateFrom)
        : true
      const toOk = customDateTo
        ? created <= new Date(customDateTo)
        : true
      return fromOk && toOk
    }
    return true
  }

  const applyFilters = (items) => {
    const query = searchQuery.trim().toLowerCase()

    return items.filter((item) => {
      if (query) {
        const inMessage = (item.message || item.message_preview || '')
          .toLowerCase()
          .includes(query)
        const inCustomerId = (item.customer_id || '')
          .toLowerCase()
          .includes(query)
        const inCategory = (item.category || '')
          .toLowerCase()
          .includes(query)

        if (!inMessage && !inCustomerId && !inCategory) {
          return false
        }
      }

      if (
        sentimentFilter !== 'all' &&
        (item.sentiment_label || '').toLowerCase() !== sentimentFilter
      ) {
        return false
      }

      if (
        sourceFilter !== 'all' &&
        (canonicalSources.includes(sourceFilter)
          ? normalizeSourceGroup(item.source) !== sourceFilter
          : (item.source || '').toLowerCase() !== sourceFilter)
      ) {
        return false
      }

      if (
        categoryFilter !== 'all' &&
        (item.category || '').toLowerCase() !== categoryFilter
      ) {
        return false
      }

      if (priorityFilter === 'high') {
        if (!item.priority || item.priority < 80) {
          return false
        }
      }

      if (!matchesDateRange(item.created_at)) {
        return false
      }

      return true
    })
  }

  const applyFiltersIgnoringSource = (items) => {
    const query = searchQuery.trim().toLowerCase()

    return items.filter((item) => {
      if (query) {
        const inMessage = (item.message || item.message_preview || '')
          .toLowerCase()
          .includes(query)
        const inCustomerId = (item.customer_id || '')
          .toLowerCase()
          .includes(query)
        const inCategory = (item.category || '')
          .toLowerCase()
          .includes(query)

        if (!inMessage && !inCustomerId && !inCategory) {
          return false
        }
      }

      if (
        sentimentFilter !== 'all' &&
        (item.sentiment_label || '').toLowerCase() !== sentimentFilter
      ) {
        return false
      }

      if (
        categoryFilter !== 'all' &&
        (item.category || '').toLowerCase() !== categoryFilter
      ) {
        return false
      }

      if (priorityFilter === 'high') {
        if (!item.priority || item.priority < 80) {
          return false
        }
      }

      if (!matchesDateRange(item.created_at)) {
        return false
      }

      return true
    })
  }

  const peakTimesTotalCount = useMemo(() => {
    if (!Array.isArray(peakTimes) || peakTimes.length === 0) return 0
    return peakTimes.reduce((sum, pt) => sum + (Number(pt?.count) || 0), 0)
  }, [peakTimes])

  const peakTimesMaxCount = useMemo(() => {
    if (!Array.isArray(peakTimes) || peakTimes.length === 0) return 0
    return peakTimes.reduce((m, pt) => Math.max(m, Number(pt?.count) || 0), 0)
  }, [peakTimes])

  const categoryTrendPivot = useMemo(() => {
    const rows = Array.isArray(categoryTrends) ? categoryTrends : []
    if (rows.length === 0) return { data: [], categories: [] }

    const totals = new Map()
    for (const r of rows) {
      const cat = String(r?.category || 'Uncategorized')
      const c = Number(r?.count) || 0
      totals.set(cat, (totals.get(cat) || 0) + c)
    }

    const topCats = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([cat]) => cat)

    const byDate = new Map()
    for (const r of rows) {
      const date = String(r?.date || '')
      if (!date) continue
      const cat = String(r?.category || 'Uncategorized')
      if (!topCats.includes(cat)) continue
      const c = Number(r?.count) || 0
      const bucket = byDate.get(date) || { date }
      bucket[cat] = (bucket[cat] || 0) + c
      byDate.set(date, bucket)
    }

    const data = Array.from(byDate.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    )
    return { data, categories: topCats }
  }, [categoryTrends])

  /** Daily counts per product (primary policy match) — same shape as category trends for LineChart */
  const productPulseTrendPivot = useMemo(() => {
    const rows = Array.isArray(productPulseTrends) ? productPulseTrends : []
    if (rows.length === 0) return { data: [], products: [] }

    const totals = new Map()
    for (const r of rows) {
      const p = String(r?.product || 'Unknown')
      const c = Number(r?.count) || 0
      totals.set(p, (totals.get(p) || 0) + c)
    }

    const topProducts = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name)

    const byDate = new Map()
    for (const r of rows) {
      const date = String(r?.date || '')
      if (!date) continue
      const p = String(r?.product || 'Unknown')
      if (!topProducts.includes(p)) continue
      const c = Number(r?.count) || 0
      const bucket = byDate.get(date) || { date }
      bucket[p] = (bucket[p] || 0) + c
      byDate.set(date, bucket)
    }

    const data = Array.from(byDate.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    )
    return { data, products: topProducts }
  }, [productPulseTrends])

  const filteredPriorityQueue = applyFilters(priorityQueue)
  const filteredRecentFeedback = applyFilters(recentFeedback)

  const getStatus = (item) => statusById[item.id] || 'New'

  const visiblePriorityQueue = filteredPriorityQueue.filter(
    (item) => getStatus(item) !== 'Archived'
  )
  const visibleRecentFeedback = filteredRecentFeedback.filter(
    (item) => getStatus(item) !== 'Archived'
  )

  const sourceTabCounts = useMemo(() => {
    if (mode === 'inbox' && serverSourceCounts?.raw && serverSourceCounts?.grouped) {
      return {
        all: Number(serverSourceCounts.total) || 0,
        ...serverSourceCounts.raw,
        ...serverSourceCounts.grouped,
      }
    }
    const counts = {}
    const uniqueById = new Map()
    for (const it of applyFiltersIgnoringSource(recentFeedback)) {
      if (it?.id == null) continue
      uniqueById.set(it.id, it)
    }
    for (const it of applyFiltersIgnoringSource(priorityQueue)) {
      if (it?.id == null) continue
      uniqueById.set(it.id, it)
    }

    const countBase = Array.from(uniqueById.values()).filter(
      (it) => getStatus(it) !== 'Archived'
    )

    counts.all = countBase.length
    for (const it of countBase) {
      const raw = String(it?.source || '').toLowerCase()
      if (!raw) continue
      counts[raw] = (counts[raw] || 0) + 1
      const group = normalizeSourceGroup(raw)
      if (group && group !== raw) {
        counts[group] = (counts[group] || 0) + 1
      }
    }
    return counts
  }, [
    mode,
    serverSourceCounts,
    priorityQueue,
    recentFeedback,
    searchQuery,
    sentimentFilter,
    categoryFilter,
    priorityFilter,
    dateRange,
    customDateFrom,
    customDateTo,
    statusById,
  ])

  const openFeedbackModal = (item) => {
    setSelectedFeedback(item)
    setIsDetailOpen(true)

    if (unreadPriorityIds.has(item.id)) {
      setUnreadPriorityIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
    if (unreadRecentIds.has(item.id)) {
      setUnreadRecentIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  const toggleSelected = (id) => {
    if (!id) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const batchUpdateStatus = (items, newStatus) => {
    if (!items?.length) return
    setStatusById((prev) => {
      const next = { ...prev }
      for (const it of items) {
        if (it?.id) next[it.id] = newStatus
      }
      return next
    })
    clearSelection()
  }

  const closeFeedbackModal = () => {
    setIsDetailOpen(false)
    setSelectedFeedback(null)
  }

  const updateStatus = (item, newStatus) => {
    if (!item?.id) return
    setStatusById((prev) => ({
      ...prev,
      [item.id]: newStatus,
    }))
  }

  const setReaction = (itemId, reaction) => {
    setReactionsById((prev) => {
      const current = prev[itemId] || { thumbsUp: false, thumbsDown: false, flagged: false }
      const next = { ...current }

      if (reaction === 'thumbsUp') {
        next.thumbsUp = !current.thumbsUp
        if (next.thumbsUp) next.thumbsDown = false
      } else if (reaction === 'thumbsDown') {
        next.thumbsDown = !current.thumbsDown
        if (next.thumbsDown) next.thumbsUp = false
      } else if (reaction === 'flag') {
        next.flagged = !current.flagged
      }

      return {
        ...prev,
        [itemId]: next,
      }
    })
  }

  const getStatusClasses = (status) => {
    switch (status) {
      case 'Resolved':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-100'
      case 'In Progress':
        return 'bg-amber-50 text-amber-700 border border-amber-100'
      case 'Archived':
        return 'bg-gray-100 text-gray-600 border border-gray-200'
      default:
        return 'bg-blue-50 text-blue-700 border border-blue-100'
    }
  }
  const handleExportCsv = () => {
    try {
      const rows = []
      rows.push(['Section', 'Key', 'Value'])
      rows.push(['Metrics', 'Total feedback', metrics.totalFeedback])
      rows.push(['Metrics', 'Positive', metrics.positive])
      rows.push(['Metrics', 'Negative', metrics.negative])
      rows.push(['Metrics', 'Neutral', metrics.neutral])
      rows.push(['Metrics', 'High priority', metrics.highPriority])

      sentimentData.forEach((s) => {
        if (s.name && s.value != null) {
          rows.push(['Sentiment', s.name, s.value])
        }
      })

      categoryData.forEach((c) => {
        if (c.name && c.value != null) {
          rows.push(['Category', c.name, c.value])
        }
      })

      const header = ['date', 'total', 'positive', 'negative', 'neutral']
      rows.push([])
      rows.push(['Trends (last 30 days)'])
      rows.push(header)
      trendData.forEach((t) => {
        rows.push([
          t.date || '',
          t.total ?? '',
          t.positive ?? '',
          t.negative ?? '',
          t.neutral ?? '',
        ])
      })

      const csv = rows
        .map((row) =>
          row
            .map((cell) => {
              if (cell == null) return ''
              const str = String(cell)
              return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
            })
            .join(','),
        )
        .join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute(
        'download',
        `feedback_dashboard_${new Date().toISOString().slice(0, 10)}.csv`,
      )
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      pushToast('Export ready', 'Dashboard summary CSV downloaded.', 'success')
    } catch (err) {
      console.error('Failed to export CSV', err)
      pushToast('Export failed', 'Could not build the CSV. Try again.', 'error')
    }
  }

  const handleExportCSV = () => {
    const rows = recentFeedback.length > 0 ? recentFeedback : priorityQueue
    if (!rows || rows.length === 0) {
      pushToast(
        'Nothing to export',
        'No feedback matches the current filters. Clear filters or widen the date range.',
        'info',
      )
      return
    }

    const header = [
      'id',
      'source',
      'customer_id',
      'category',
      'rating',
      'sentiment_label',
      'sentiment_score',
      'priority',
      'created_at',
    ]

    const csvRows = [
      header.join(','),
      ...rows.map((item) =>
        header
          .map((field) => {
            const value = item[field] ?? ''
            const escaped = String(value).replace(/"/g, '""')
            return `"${escaped}"`
          })
          .join(','),
      ),
    ]

    try {
      const blob = new Blob([csvRows.join('\n')], {
        type: 'text/csv;charset=utf-8;',
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'feedback_export.csv')
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      pushToast('Export ready', 'Inbox feedback CSV downloaded.', 'success')
    } catch (err) {
      console.error('Failed to export CSV:', err)
      pushToast('Export failed', 'Unable to export CSV in this environment.', 'error')
    }
  }

  const handleExportPDF = () => {
    // Simple placeholder: users can use browser print-to-PDF for now
    alert(
      'PDF export will be added as a dedicated report layout.\n\nFor now, you can use your browser’s Print > Save as PDF on the dashboard.',
    )
  }

  const handleScheduleReports = () => {
    if (onNavigateScheduleReport) return onNavigateScheduleReport()
    pushToast('Not available', 'Could not open the Schedule report page from here.', 'info')
  }

  const handleOpenCustomReportBuilder = () => {
    if (onNavigateCustomReport) return onNavigateCustomReport()
    pushToast('Not available', 'Could not open the Custom report page from here.', 'info')
  }


  const handleQuickFilter = (type) => {
    if (type === 'clear') {
      setSearchQuery('')
      setSentimentFilter('all')
      setSourceFilter('all')
      setCategoryFilter('all')
      setPriorityFilter('all')
      setDateRange('all')
      setCustomDateFrom('')
      setCustomDateTo('')
      return
    }

    if (type === 'high_priority') {
      setPriorityFilter('high')
      setDateRange('all')
      return
    }

    if (type === 'this_week') {
      setDateRange('7d')
      return
    }

    if (type === 'web_mentions') {
      setSourceFilter('web')
      return
    }

    if (type === 'negative_7d') {
      setSentimentFilter('negative')
      setDateRange('7d')
      return
    }

    if (type === 'web_7d') {
      setSourceFilter('web')
      setDateRange('7d')
      return
    }

    if (type === 'unresolved') {
      setPriorityFilter('high')
      setSentimentFilter('negative')
      setDateRange('30d')
    }
  }

  const inboxActiveFilterLabels = useMemo(() => {
    if (mode !== 'inbox') return []
    const parts = []
    const q = searchQuery.trim()
    if (q) {
      parts.push(`Search: "${q.length > 36 ? `${q.slice(0, 36)}…` : q}"`)
    }
    if (sentimentFilter !== 'all') {
      parts.push(`Sentiment: ${formatSentimentWord(sentimentFilter)}`)
    }
    if (priorityFilter === 'high') {
      parts.push('High priority')
    }
    if (sourceFilter !== 'all') {
      parts.push(`Source: ${sourceFilter}`)
    }
    if (categoryFilter !== 'all') {
      parts.push(`Category: ${categoryFilter}`)
    }
    if (dateRange !== 'all') {
      const dr = { '7d': 'Last 7 days', '30d': 'Last 30 days', custom: 'Custom range' }
      parts.push(dr[dateRange] || `Dates: ${dateRange}`)
    }
    return parts
  }, [
    mode,
    searchQuery,
    sentimentFilter,
    priorityFilter,
    sourceFilter,
    categoryFilter,
    dateRange,
  ])

  const savedViews = useMemo(
    () => [
      { id: 'all', label: 'All feedback', apply: () => handleQuickFilter('clear') },
      { id: 'web', label: 'Web mentions', apply: () => handleQuickFilter('web_mentions') },
      { id: 'web7d', label: 'Web mentions · last 7 days', apply: () => handleQuickFilter('web_7d') },
      { id: 'high', label: 'High priority', apply: () => handleQuickFilter('high_priority') },
      { id: 'neg7d', label: 'Negative · last 7 days', apply: () => handleQuickFilter('negative_7d') },
      { id: 'unresolved', label: 'Unresolved (neg. & high priority)', apply: () => handleQuickFilter('unresolved') },
    ],
    [],
  )

  const [selectedSavedView, setSelectedSavedView] = useState('all')

  const inboxHasActiveFilters = inboxActiveFilterLabels.length > 0

  const sentimentChartHasRealData = useMemo(
    () =>
      sentimentData.some((s) => s.name !== 'No Data' && s.name !== 'Error' && Number(s.value) > 0),
    [sentimentData],
  )

  const insuranceTagsBarChartData = useMemo(() => {
    const b = insuranceTagsBreakdown || {}
    const rows = Object.entries(b)
      .map(([k, v], i) => ({
        name: formatInsuranceTagChartLabel(k),
        value: Number(v?.total ?? 0),
        fill: CHART_PALETTE[i % CHART_PALETTE.length],
        _key: k,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
    return rows.length > 0
      ? rows
      : [{ name: 'No data', value: 0, fill: '#d1d5db' }]
  }, [insuranceTagsBreakdown])

  const categoryChartHasRealData = useMemo(() => {
    const b = insuranceTagsBreakdown || {}
    return Object.values(b).some((v) => Number(v?.total ?? 0) > 0)
  }, [insuranceTagsBreakdown])

  return (
    <div className="relative p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
      {/* Feedback detail modal */}
      {isDetailOpen && selectedFeedback && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Feedback Details
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  ID #{selectedFeedback.id}{' '}
                  {selectedFeedback.created_at &&
                    `· ${new Date(selectedFeedback.created_at).toLocaleString()}`}
                </p>
              </div>
              <button
                type="button"
                onClick={closeFeedbackModal}
                className="inline-flex items-center justify-center rounded-full p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800 dark:focus:ring-offset-gray-900"
              >
                <span className="sr-only">Close</span>
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4 overflow-y-auto">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusClasses(
                    getStatus(selectedFeedback)
                  )}`}
                >
                  {getStatus(selectedFeedback)}
                </span>
                {selectedFeedback.sentiment_label && (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedFeedback.sentiment_label === 'negative'
                        ? 'bg-red-100 text-red-700'
                        : selectedFeedback.sentiment_label === 'positive'
                        ? 'bg-[#009750]/10 text-[#009750]'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {formatSentimentWord(selectedFeedback.sentiment_label)}
                  </span>
                )}
                {selectedFeedback.category && (
                  <span className="px-3 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                    {selectedFeedback.category}
                  </span>
                )}
                {selectedFeedback.priority && (
                  <span className="px-3 py-1 rounded-full text-xs bg-amber-100 text-amber-700 font-semibold">
                    Priority: {selectedFeedback.priority}
                  </span>
                )}
              </div>

              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {selectedFeedback.message || selectedFeedback.message_preview || 'No message'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-600">
                <div className="space-y-1">
                  {selectedFeedback.source && (
                    <p>
                      <span className="font-medium text-gray-700">Source:</span>{' '}
                      {selectedFeedback.source}
                    </p>
                  )}
                  {selectedFeedback.source === 'web' && (() => {
                    const meta = safeParseJson(selectedFeedback.channel_metadata)
                    const url = meta?.url
                    const publisher = meta?.publisher
                    const matchedKeyword = meta?.matched_keyword
                    const query = meta?.query
                    return (
                      <div className="space-y-1">
                        {url && (
                          <p className="break-all">
                            <span className="font-medium text-gray-700">URL:</span>{' '}
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-[#009750] hover:underline"
                            >
                              {url}
                            </a>
                          </p>
                        )}
                        {publisher && (
                          <p>
                            <span className="font-medium text-gray-700">Publisher:</span>{' '}
                            {publisher}
                          </p>
                        )}
                        {matchedKeyword && (
                          <p>
                            <span className="font-medium text-gray-700">Matched keyword:</span>{' '}
                            {matchedKeyword}
                          </p>
                        )}
                        {query && (
                          <p className="break-words">
                            <span className="font-medium text-gray-700">Query:</span>{' '}
                            {query}
                          </p>
                        )}
                      </div>
                    )
                  })()}
                  {selectedFeedback.customer_id && (
                    <p>
                      <span className="font-medium text-gray-700">Customer ID:</span>{' '}
                      {selectedFeedback.customer_id}
                    </p>
                  )}
                  {selectedFeedback.rating && (
                    <p>
                      <span className="font-medium text-gray-700">Rating:</span>{' '}
                      Rating {selectedFeedback.rating}/5
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <p>
                    <span className="font-medium text-gray-700">Sentiment score:</span>{' '}
                    {selectedFeedback.sentiment_score != null
                      ? selectedFeedback.sentiment_score.toFixed(3)
                      : '—'}
                  </p>
                  {selectedFeedback.tags && Array.isArray(selectedFeedback.tags) && (
                    <p>
                      <span className="font-medium text-gray-700">Tags:</span>{' '}
                      {selectedFeedback.tags.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateStatus(selectedFeedback, 'Resolved')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
                >
                  <FiCheckCircle className="w-4 h-4" />
                  Mark as resolved
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(selectedFeedback, 'In Progress')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 transition-colors"
                >
                  <FiUserPlus className="w-4 h-4" />
                  Assign
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(selectedFeedback, 'New')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#009750] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#007a42] transition-colors"
                >
                  <FiMail className="w-4 h-4" />
                  Reply
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(selectedFeedback, 'Archived')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  <FiArchive className="w-4 h-4" />
                  Archive
                </button>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const r = reactionsById[selectedFeedback.id] || {
                    thumbsUp: false,
                    thumbsDown: false,
                    flagged: false,
                  }
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => setReaction(selectedFeedback.id, 'thumbsUp')}
                        className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-medium ${
                          r.thumbsUp
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <FiThumbsUp className="w-3.5 h-3.5 mr-1" />
                        Helpful
                      </button>
                      <button
                        type="button"
                        onClick={() => setReaction(selectedFeedback.id, 'thumbsDown')}
                        className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-medium ${
                          r.thumbsDown
                            ? 'bg-red-50 border-red-300 text-red-700'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <FiThumbsDown className="w-3.5 h-3.5 mr-1" />
                        Not helpful
                      </button>
                      <button
                        type="button"
                        onClick={() => setReaction(selectedFeedback.id, 'flag')}
                        className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-medium ${
                          r.flagged
                            ? 'bg-amber-50 border-amber-300 text-amber-700'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <FiFlag className="w-3.5 h-3.5 mr-1" />
                        Flag
                      </button>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Main Title */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          {loading || !analyticsDelayPassed ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-8 w-64 bg-gray-100 rounded-lg" />
              <div className="h-4 w-72 bg-gray-100 rounded-lg" />
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                {mode === 'inbox' ? 'Feedback Inbox' : 'Feedback Dashboard'}
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                {mode === 'inbox'
                  ? 'Search, triage, and act on individual customer feedback across all channels'
                  : 'Monitor and analyze customer feedback across all channels'}
              </p>
              {/* Role-based conditional rendering is driven by signup role (no UI tabs). */}
              {lastUpdated && !error && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Updated {formatRelativeTime(lastUpdated.toISOString())}
                  {isAdminUser && dashboardAutoRefresh && (
                    <> · auto-refresh every 30s · live analytics when new feedback arrives</>
                  )}
                  {isAdminUser && !dashboardAutoRefresh && (
                    <> · auto-refresh off (admins can enable it in the toolbar)</>
                  )}
                </p>
              )}
            </>
          )}
        </div>

        {(mode === 'overview' || mode === 'insights') && !loading && (
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => reloadDashboardRef.current?.()}
              className="inline-flex items-center justify-center min-h-[44px] rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <FiRefreshCw className="h-4 w-4 mr-1.5" />
              Refresh
            </button>
            {isAdminUser && (
              <label className="inline-flex items-center gap-2 min-h-[44px] cursor-pointer select-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-[#009750] focus:ring-[#009750]"
                  checked={dashboardAutoRefresh}
                  onChange={(e) => {
                    const on = e.target.checked
                    setDashboardAutoRefresh(on)
                    try {
                      localStorage.setItem(DASHBOARD_AUTO_REFRESH_KEY, on ? '1' : '0')
                    } catch {
                      // ignore
                    }
                  }}
                />
                <span>Auto-refresh (30s + live)</span>
              </label>
            )}
            {mode === 'overview' && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center justify-center min-h-[44px] rounded-lg bg-[#009750] px-3.5 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#007a42] transition-colors"
              >
                <FiDownload className="w-4 h-4 mr-1.5" />
                Export CSV
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg"
          role="alert"
        >
          <p className="text-sm pr-2">{error}</p>
          <button
            type="button"
            onClick={() => reloadDashboardRef.current?.()}
            className="inline-flex shrink-0 items-center justify-center gap-2 min-h-[44px] rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
          >
            <FiRefreshCw className="h-4 w-4" aria-hidden />
            Retry
          </button>
        </div>
      )}

      {(mode === 'overview' || mode === 'insights') && (
        <>
      {mode === 'overview' && (
        <>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300 shrink-0">Filter by:</span>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'today', label: 'Today', Icon: FiClock },
                    { id: 'week', label: 'This Week', Icon: FiCalendar },
                    { id: 'month', label: 'This Month', Icon: FiCalendar },
                    { id: 'all', label: 'All Time', Icon: FiCalendar },
                  ].map(({ id, label, Icon }) => {
                    const active = overviewTimeFilter === id
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setOverviewTimeFilter(id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px] ${
                          active
                            ? 'border-[#009750] bg-[#009750] text-white shadow-sm'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
                        }`}
                        aria-pressed={active}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

          <OverviewMetricCards
            metrics={metrics}
            kpiTrackPercent={kpiTrackPercent}
            analyticsLoading={analyticsLoading}
            analyticsDelayPassed={analyticsDelayPassed}
            activeKpiChange={activeKpiChange}
            setActiveKpiChange={setActiveKpiChange}
            onKpiPointerEnter={onKpiPointerEnter}
            onKpiPointerLeave={onKpiPointerLeave}
            managementInsights={managementInsights}
            getRelatedAlerts={kpiRelatedAlerts}
            navigateToInboxPreset={navigateToInboxPreset}
          />
        </>
      )}

          {mode === 'overview' && (
            <OverviewChartsSection
              isCx={isCx}
              analyticsLoading={analyticsLoading}
              analyticsDelayPassed={analyticsDelayPassed}
              sentimentChartHasRealData={sentimentChartHasRealData}
              categoryChartHasRealData={categoryChartHasRealData}
              sentimentData={sentimentData}
              overviewInsuranceTagsCaption={overviewInsuranceTagsCaption}
              insuranceTagsBarChartData={insuranceTagsBarChartData}
              isDarkMode={isDarkMode}
              productPulse={productPulse}
              trendData={trendData}
              trendYMax={trendYMax}
              trendAllZero={trendAllZero}
              onNavigateToInsights={onNavigateToInsights}
            />
          )}

          {mode === 'insights' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigateBack?.()}
                  className="inline-flex items-center justify-center h-11 w-11 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#009750]/40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                  aria-label="Back to overview"
                >
                  <FiArrowLeft className="w-5 h-5" aria-hidden />
                </button>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                    Insights
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Filter by product name to focus charts on one plan; all charts use the same range and product scope.
                  </p>
                    </div>
                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="insights-product-filter" className="sr-only">
                      Filter by product name
                    </label>
                    <select
                      id="insights-product-filter"
                      value={insightsProductKey}
                      onChange={(e) => setInsightsProductKey(e.target.value)}
                      className="min-h-[40px] max-w-[min(100vw-2rem,20rem)] rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      aria-label="Filter insights by product name"
                    >
                      <option value="">All products</option>
                      {insightsProductOptions.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div
                    className="inline-flex rounded-full border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900"
                    role="group"
                    aria-label="Insights range"
                  >
                    {[7, 30, 90].map((d) => {
                      const active = insightsRange === d
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setInsightsRange(d)}
                          className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#009750]/40 ${
                            active
                              ? 'bg-[#009750] text-white'
                              : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800'
                          }`}
                          aria-pressed={active}
                        >
                          {d}d
                        </button>
                      )
                    })}
                  </div>
                    </div>
                  </div>

              <div className="card p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Product pulse over time (Last {insightsRange} Days)
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Daily feedback volume for your top products (from primary product/policy detection). Aligns with
                  the 7d / 30d / 90d filter above.
                </p>
                {analyticsLoading || !analyticsDelayPassed ? (
                  <div className="w-full h-[280px] bg-gray-50 dark:bg-gray-900/40 rounded-xl animate-pulse" />
                ) : productPulseTrendPivot.products.length === 0 || productPulseTrendPivot.data.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    No product matches in this window yet. When feedback includes a detected primary product or policy,
                    trends appear here.
                  </p>
                ) : (
                  <div style={{ height: '280px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={productPulseTrendPivot.data}>
                        <XAxis
                          dataKey="date"
                          tick={{ fill: isDarkMode ? '#d1d5db' : '#6b7280', fontSize: 11 }}
                          axisLine={{ stroke: isDarkMode ? '#374151' : '#d1d5db' }}
                          tickFormatter={(v) => {
                            if (v == null || typeof v !== 'string') return v
                            const parts = v.split('-')
                            return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : v
                          }}
                        />
                        <YAxis
                          tick={{ fill: isDarkMode ? '#d1d5db' : '#6b7280', fontSize: 11 }}
                          axisLine={{ stroke: isDarkMode ? '#374151' : '#d1d5db' }}
                          allowDecimals={false}
                        />
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={isDarkMode ? '#1f2937' : '#e5e7eb'}
                          vertical={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                            border: `1px solid ${isDarkMode ? '#374151' : '#d1d5db'}`,
                            borderRadius: '8px',
                            color: isDarkMode ? '#f9fafb' : '#1f2937',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          }}
                          labelStyle={{ color: isDarkMode ? '#f9fafb' : '#111827' }}
                        />
                        <Legend />
                        {productPulseTrendPivot.products.map((prod, idx) => (
                          <Line
                            key={prod}
                            type="monotone"
                            dataKey={prod}
                            name={prod}
                            stroke={CHART_PALETTE[idx % CHART_PALETTE.length] || VIRIDIS.green}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card p-4 sm:p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Category Trends (Last {insightsRange} Days)
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      How frequently each category appears over time. Focus on your top issue types.
                    </p>
                    {analyticsLoading || !analyticsDelayPassed ? (
                      <div className="w-full h-[260px] bg-gray-50 rounded-xl animate-pulse" />
                    ) : (
                      <div style={{ height: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={categoryTrendPivot.data}>
                            <XAxis
                              dataKey="date"
                              tick={{ fill: isDarkMode ? '#d1d5db' : '#6b7280', fontSize: 11 }}
                              axisLine={{ stroke: isDarkMode ? '#374151' : '#d1d5db' }}
                            />
                            <YAxis
                              tick={{ fill: isDarkMode ? '#d1d5db' : '#6b7280', fontSize: 11 }}
                              axisLine={{ stroke: isDarkMode ? '#374151' : '#d1d5db' }}
                              allowDecimals={false}
                            />
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={isDarkMode ? '#1f2937' : '#e5e7eb'}
                              vertical={false}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                                border: `1px solid ${isDarkMode ? '#374151' : '#d1d5db'}`,
                                borderRadius: '8px',
                                color: isDarkMode ? '#f9fafb' : '#1f2937',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                              }}
                              labelStyle={{ color: isDarkMode ? '#f9fafb' : '#111827' }}
                            />
                            <Legend />
                            {categoryTrendPivot.categories.length === 0 ? (
                              <Line
                                type="monotone"
                                dataKey="count"
                                name="Count"
                                stroke={SENTIMENT_COLORS.Positive}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4 }}
                              />
                            ) : (
                              categoryTrendPivot.categories.map((cat, idx) => (
                                <Line
                                  key={cat}
                                  type="monotone"
                                  dataKey={cat}
                                  name={cat}
                                  stroke={CHART_PALETTE[idx % CHART_PALETTE.length] || SENTIMENT_COLORS.Positive}
                                  strokeWidth={2}
                                  dot={false}
                                  activeDot={{ r: 4 }}
                                  connectNulls
                                />
                              ))
                            )}
                          </LineChart>
                        </ResponsiveContainer>
            </div>
            )}
          </div>

            <div className="card p-4 sm:p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Insurance Categories (Last {insightsRange} Days)
              </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Rule-based tags: one primary theme per feedback (first ranked tag) so bar totals in this
                    range add up to feedback count for the same window.
              </p>
              {analyticsLoading || !analyticsDelayPassed ? (
                <div className="w-full h-[260px] bg-gray-50 rounded-xl animate-pulse" />
              ) : (
                <div style={{ height: '260px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={Object.entries(insuranceTagsBreakdown || {})
                            .map(([k, v]) => ({
                              tag: k,
                              count: Number(v?.total ?? 0),
                            }))
                            .filter((r) => r.count > 0)
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 10)
                            .map((row, idx) => ({ ...row, fill: CHART_PALETTE[idx % CHART_PALETTE.length] }))}
                          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                        >
                      <XAxis
                            dataKey="tag"
                            tick={{ fill: isDarkMode ? '#d1d5db' : '#6b7280', fontSize: 11 }}
                            axisLine={{ stroke: isDarkMode ? '#374151' : '#d1d5db' }}
                            tickLine={{ stroke: isDarkMode ? '#374151' : '#d1d5db' }}
                        interval={0}
                            angle={-20}
                            textAnchor="end"
                            height={58}
                      />
                      <YAxis
                            tick={{ fill: isDarkMode ? '#d1d5db' : '#6b7280', fontSize: 11 }}
                            axisLine={{ stroke: isDarkMode ? '#374151' : '#d1d5db' }}
                        allowDecimals={false}
                      />
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={isDarkMode ? '#1f2937' : '#e5e7eb'}
                            vertical={false}
                          />
                      <Tooltip
                        contentStyle={{
                              backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                              border: `1px solid ${isDarkMode ? '#374151' : '#d1d5db'}`,
                          borderRadius: '8px',
                              color: isDarkMode ? '#f9fafb' : '#1f2937',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        }}
                            labelStyle={{ color: isDarkMode ? '#f9fafb' : '#111827' }}
                            formatter={(value) => [value, 'Count']}
                          />
                          <Bar dataKey="count" name="Count">
                            {(Object.entries(insuranceTagsBreakdown || {})
                              .map(([k, v]) => ({ tag: k, count: Number(v?.total ?? 0) }))
                              .filter((r) => r.count > 0)
                              .sort((a, b) => b.count - a.count)
                              .slice(0, 10)).map((row, idx) => (
                              <Cell key={`ins-${row.tag}`} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                            ))}
                          </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="card p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                      Source Trend (Last {insightsRange} Days)
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                      Daily feedback volume by top channels (remaining channels grouped as “other”).
              </p>
              {analyticsLoading || !analyticsDelayPassed ? (
                <div className="w-full h-[260px] bg-gray-50 rounded-xl animate-pulse" />
              ) : (
                <div style={{ height: '260px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={sourceTrends?.data || []}>
                      <XAxis
                        dataKey="date"
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                        axisLine={{ stroke: '#d1d5db' }}
                      />
                      <YAxis
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                        axisLine={{ stroke: '#d1d5db' }}
                        allowDecimals={false}
                      />
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          color: '#1f2937',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        }}
                      />
                            <Legend />
                            {(Array.isArray(sourceTrends?.sources) ? sourceTrends.sources : []).map((src) => {
                              const key = String(src || '')
                              if (!key) return null
                              return (
                      <Line
                                  key={key}
                        type="monotone"
                                  dataKey={key}
                                  name={key === 'google_forms' ? 'Google Forms' : key.replace(/_/g, ' ')}
                                  stroke={sourceTrendColors[key] || '#6b7280'}
                                  strokeWidth={2}
                                  dot={false}
                                  activeDot={{ r: 4 }}
                                />
                              )
                            })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              </div>

                <div className="card p-6 lg:col-span-2">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Peak Feedback Times (Last {insightsRange} Days)
                      </h2>
                    </div>
                    {analyticsLoading ? (
                      <div className="w-full h-[260px] bg-gray-50 rounded-xl animate-pulse" />
                    ) : (
                      <>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                          Counts of feedback by day of week and hour (UTC). Color shows sentiment (greener when
                          more positive than negative, redder when more negative); intensity reflects volume.
                        </p>
                        {peakTimesTotalCount === 0 && (
                          <p className="mb-3 text-xs text-gray-500">
                            No peak-time data yet. Add more feedback and refresh.
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <div className="inline-flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                            <span className="font-semibold shrink-0">More negative</span>
                            <span
                              className="h-2.5 w-28 rounded-full border border-gray-200 dark:border-gray-700"
                              style={{
                                background: `linear-gradient(90deg, hsl(0, 72%, ${isDarkMode ? 38 : 52}%) 0%, hsl(60, 55%, ${
                                  isDarkMode ? 42 : 58
                                }%) 50%, hsl(120, 65%, ${isDarkMode ? 36 : 48}%) 100%)`,
                              }}
                            />
                            <span className="font-semibold shrink-0">More positive</span>
                          </div>
                          {heatmapHover?.count != null ? (
                            <div className="text-[11px] text-gray-600 dark:text-gray-300">
                              <span className="font-semibold">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][heatmapHover?.dow] || ''}
                              </span>
                              <span className="font-medium">
                                {' '}
                                · {String(heatmapHover?.hour).padStart(2, '0')}:00–{String((heatmapHover?.hour + 1) % 24).padStart(2, '0')}:00
                              </span>
                              <span className="font-medium"> · {heatmapHover.count} total</span>
                              <span className="font-medium">
                                {' '}
                                · {heatmapHover.pos ?? 0} positive · {heatmapHover.neg ?? 0} negative ·{' '}
                                {heatmapHover.neu ?? 0} neutral
                              </span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              Hover a cell to see details.
                            </div>
                          )}
          </div>

                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr>
                                <th className="px-2 py-1 text-left text-gray-500 dark:text-gray-400 font-medium">
                                  Hour
                                </th>
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                                  <th
                                    key={label}
                                    className="px-2 py-1 text-center text-gray-500 dark:text-gray-400 font-medium"
                                  >
                                    {label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {Array.from({ length: 24 }).map((_, hour) => (
                                <tr
                                  key={hour}
                                  className="border-t border-gray-100 dark:border-gray-800"
                                >
                                  <td className="px-2 py-1 text-gray-500 dark:text-gray-400">
                                    {String(hour).padStart(2, '0')}:00
                                  </td>
                                  {Array.from({ length: 7 }).map((__, dow) => {
                                    const cell = peakTimes.find((pt) => pt.day_of_week === dow && pt.hour === hour)
                                    const count = cell?.count || 0
                                    const pos = cell?.positive || 0
                                    const neg = cell?.negative || 0
                                    const neu = cell?.neutral || 0
                                    const hm = getPeakHeatmapCellStyles(pos, neg, count, peakTimesMaxCount, isDarkMode)
                                    const canClick = count > 0
                                    return (
                                      <td
                                        key={dow}
                                        className={`px-2 py-1 text-center align-middle ${hm.classBg} ${hm.textClass} rounded-sm ${
                                          canClick ? 'cursor-pointer hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#009750]/40' : ''
                                        }`}
                                        style={hm.style}
                                        title={`${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dow]} ${String(
                                          hour,
                                        ).padStart(2, '0')}:00 · ${count} total · ${pos} positive · ${neg} negative · ${neu} neutral`}
                                        onMouseEnter={() => setHeatmapHover({ dow, hour, count, pos, neg, neu })}
                                        onMouseLeave={() => setHeatmapHover(null)}
                                        onClick={() => {
                                          if (!canClick) return
                                          onNavigateToInbox?.({
                                            mode: 'peak_time',
                                            dow,
                                            hour,
                                            range_days: insightsRange,
                                          })
                                        }}
                                        role={canClick ? 'button' : undefined}
                                        tabIndex={canClick ? 0 : undefined}
                                        onKeyDown={(e) => {
                                          if (!canClick) return
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            onNavigateToInbox?.({
                                              mode: 'peak_time',
                                              dow,
                                              hour,
                                              range_days: insightsRange,
                                            })
                                          }
                                        }}
                                      >
                                        {count || ''}
                                      </td>
                                    )
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                </div>
              </div>
            </div>
          )}

          {mode === 'overview' && (
            <OverviewWordCloudAndSource
              showSourceChart={showSourceChart}
              showWordCloudSection={showWordCloudSection}
              sourceAndWordcloudSideBySide={sourceAndWordcloudSideBySide}
              analyticsLoading={analyticsLoading}
              analyticsDelayPassed={analyticsDelayPassed}
              isDarkMode={isDarkMode}
              sourcePerformance={sourcePerformance}
            />
          )}
        </>
      )}

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
          {toasts.map((toast) => {
            const variant = toast.variant || 'info'
            const iconShell =
              variant === 'success'
                ? 'bg-emerald-50 text-emerald-700'
                : variant === 'error'
                  ? 'bg-red-50 text-red-700'
                  : variant === 'warning'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-blue-50 text-blue-700'
            const IconCmp =
              variant === 'success'
                ? FiCheckCircle
                : variant === 'error' || variant === 'warning'
                  ? FiAlertTriangle
                  : FiInfo
            return (
              <div
                key={toast.id}
                className="rounded-lg bg-white shadow-lg border border-gray-200 px-4 py-3 text-xs text-gray-800 flex items-start gap-2"
              >
                <div
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconShell}`}
                >
                  <IconCmp className="w-3.5 h-3.5" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{toast.title}</p>
                  {toast.message && <p className="text-gray-600 mt-0.5">{toast.message}</p>}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setToasts((prev) => prev.filter((t) => t.id !== toast.id))
                  }
                  className="ml-1 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg"
                  aria-label="Dismiss notification"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {mode === 'inbox' && (
        <>
          <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 mb-4 px-4 sm:px-6 lg:px-8 py-3 bg-[#f0f4f1]/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-emerald-100/60 dark:border-gray-800 shadow-sm space-y-3">
            {inboxHasActiveFilters && (
              <div
                className="flex flex-wrap items-center gap-2 rounded-xl border border-[#009750]/25 bg-white px-3 py-2.5"
                role="status"
                aria-live="polite"
              >
                <span className="text-xs font-semibold text-gray-700 shrink-0">Viewing:</span>
                {inboxActiveFilterLabels.map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center rounded-full bg-[#009750]/10 px-2.5 py-1.5 text-[11px] font-medium text-[#047857]"
                  >
                    {label}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => handleQuickFilter('clear')}
                  className="ml-auto inline-flex min-h-[44px] items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#009750]/40"
                >
                  Clear all filters
                </button>
              </div>
            )}
            <div className="card p-4 sm:p-6 shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div className="w-full lg:max-w-md">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0 flex-1">
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Search feedback
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by message, customer ID, or category"
                  className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/60 focus:border-[#009750]"
                />
                  </div>
                  <div className="w-[200px] shrink-0">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">
                      Saved views
                    </label>
                    <select
                      value={selectedSavedView}
                      onChange={(e) => {
                        const next = e.target.value
                        setSelectedSavedView(next)
                        const v = savedViews.find((x) => x.id === next)
                        v?.apply?.()
                      }}
                      className="min-h-[44px] w-full rounded-lg border border-gray-300 px-2 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/60 focus:border-[#009750]"
                    >
                      {savedViews.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="w-full lg:w-auto grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    Sentiment
                  </label>
                  <select
                    value={sentimentFilter}
                    onChange={(e) => setSentimentFilter(e.target.value)}
                    className="min-h-[44px] w-full rounded-lg border border-gray-300 px-2 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/60 focus:border-[#009750]"
                  >
                    <option value="all">All sentiments</option>
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="negative">Negative</option>
                  </select>
                </div>

                {/* Source tabs live below as primary control. */}

                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    Category
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="min-h-[44px] w-full rounded-lg border border-gray-300 px-2 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/60 focus:border-[#009750]"
                  >
                    <option value="all">All categories</option>
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat.toLowerCase()}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    Date range
                  </label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="min-h-[44px] w-full rounded-lg border border-gray-300 px-2 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/60 focus:border-[#009750]"
                  >
                    <option value="all">All time</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="custom">Custom range</option>
                  </select>
                </div>
              </div>
            </div>

            {dateRange === 'custom' && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    From
                  </label>
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/60 focus:border-[#009750]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    To
                  </label>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/60 focus:border-[#009750]"
                  />
                </div>
              </div>
            )}

            <div className="mt-4">
              <div className="w-full overflow-x-auto">
                <div className="inline-flex items-center gap-2">
                  {[
                    { id: 'all', label: 'All' },
                    ...sourceTabs.map((src) => ({
                      id: src,
                      label: src === 'x' ? 'X' : src,
                    })),
                  ].map((t) => {
                    const active = sourceFilter === t.id
                    const count =
                      t.id === 'all'
                        ? (sourceTabCounts.all || 0)
                        : (sourceTabCounts[t.id] || 0)
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSourceFilter(t.id)}
                        className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all ${
                          active
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {t.id !== 'all' && <SourceLogo source={t.id} />}
                        <span className="whitespace-nowrap">{t.label}</span>
                        <span
                          className={`ml-0.5 inline-flex min-w-[28px] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            active
                              ? 'bg-emerald-700 text-white'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                          aria-label={`${count} items`}
                        >
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            </div>
          </div>

          {/* Priority Queue */}
          <div className="card p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Priority Queue</h2>
              <div className="flex items-center gap-2">
                {unreadPriorityIds.size > 0 && (
                  <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-medium text-red-700">
                    New {unreadPriorityIds.size}
                  </span>
                )}
                {selectedIds.size > 0 && (
                  <span className="inline-flex items-center rounded-full bg-gray-900 px-2.5 py-0.5 text-[11px] font-medium text-white">
                    Selected {selectedIds.size}
                  </span>
                )}
              </div>
            </div>
            {selectedIds.size > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-[36px] items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                  onClick={() => {
                    const items = visiblePriorityQueue.filter((it) => selectedIds.has(it.id))
                    batchUpdateStatus(items, 'Resolved')
                  }}
                >
                  <FiCheckCircle className="w-4 h-4 mr-1.5" />
                  Resolve selected
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-[36px] items-center rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900"
                  onClick={() => {
                    const items = visiblePriorityQueue.filter((it) => selectedIds.has(it.id))
                    batchUpdateStatus(items, 'Archived')
                  }}
                >
                  <FiArchive className="w-4 h-4 mr-1.5" />
                  Archive selected
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-[36px] items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  onClick={clearSelection}
                >
                  Clear selection
                </button>
              </div>
            )}
            {inboxLoading || !inboxDelayPassed ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-50 rounded-lg border border-gray-200 p-5 animate-pulse"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center flex-wrap gap-2">
                        <div className="h-5 w-16 bg-gray-100 rounded-full" />
                        <div className="h-5 w-20 bg-gray-100 rounded-full" />
                        <div className="h-5 w-20 bg-gray-100 rounded-full" />
                      </div>
                      <div className="h-3 w-16 bg-gray-100 rounded" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 w-full bg-gray-100 rounded" />
                      <div className="h-3 w-3/4 bg-gray-100 rounded" />
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="h-3 w-24 bg-gray-100 rounded" />
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-10 bg-gray-100 rounded-full" />
                        <div className="h-6 w-10 bg-gray-100 rounded-full" />
                        <div className="h-6 w-8 bg-gray-100 rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : visiblePriorityQueue.length > 0 ? (
              <div className="space-y-4">
                {visiblePriorityQueue.map((item) => {
                  const status = getStatus(item)
                  const r = reactionsById[item.id] || {
                    thumbsUp: false,
                    thumbsDown: false,
                    flagged: false,
                  }
                  return (
                    <div
                      key={item.id}
                      className="bg-gray-50 rounded-lg border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all duration-200 cursor-pointer"
                      onClick={() => openFeedbackModal(item)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <label
                          className="inline-flex items-center gap-2 text-xs text-gray-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelected(item.id)}
                            className="h-4 w-4 rounded border-gray-300 text-[#009750] focus:ring-[#009750]/50"
                          />
                          Select
                        </label>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                item.sentiment_label === 'negative'
                                  ? 'bg-red-100 text-red-700'
                                  : item.sentiment_label === 'positive'
                                  ? 'bg-[#009750]/10 text-[#009750]'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {formatSentimentWord(item.sentiment_label)}
                            </span>
                            {item.category && (
                              <span className="px-2.5 py-1 rounded-full text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {item.category}
                              </span>
                            )}
                            {item.priority && (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                Priority {item.priority}
                              </span>
                            )}
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${getStatusClasses(
                                status
                              )}`}
                            >
                              {status}
                            </span>
                            <SourcePill source={item.source} />
                            {item.rating && (
                              <span className="px-2.5 py-1 rounded-full text-[11px] bg-gray-50 text-gray-700 border border-gray-200">
                                Rating {item.rating}/5
                              </span>
                            )}
                          </div>
                          <p className="mt-3 text-gray-900 text-sm font-medium leading-snug line-clamp-2">
                            {item.message || item.message_preview || 'No message'}
                          </p>
                          <p className="mt-1 text-xs text-gray-500 line-clamp-1">
                            {item.customer_id ? `Customer: ${item.customer_id}` : ' '}
                          </p>
                        </div>
                        <span
                          className="text-xs text-gray-500 font-medium text-right shrink-0 max-w-[9rem] sm:max-w-none"
                          title={item.created_at ? new Date(item.created_at).toLocaleString() : undefined}
                        >
                          {item.created_at ? (
                            <>
                              <span className="block sm:inline">{formatRelativeTime(item.created_at)}</span>
                              <span className="hidden sm:inline text-gray-400"> · </span>
                              <span className="block sm:inline text-gray-400">
                                {new Date(item.created_at).toLocaleDateString()}
                              </span>
                            </>
                          ) : (
                            ''
                          )}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="text-xs text-gray-500">
                          {item.created_at ? `Received ${formatRelativeTime(item.created_at)}` : ''}
                        </div>
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setReaction(item.id, 'thumbsUp')}
                            className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[11px] ${
                              r.thumbsUp
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            <FiThumbsUp className="w-3 h-3 mr-1" />
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() => setReaction(item.id, 'thumbsDown')}
                            className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[11px] ${
                              r.thumbsDown
                                ? 'bg-red-50 border-red-300 text-red-700'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            <FiThumbsDown className="w-3 h-3 mr-1" />
                            Down
                          </button>
                          <button
                            type="button"
                            onClick={() => setReaction(item.id, 'flag')}
                            className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[11px] ${
                              r.flagged
                                ? 'bg-amber-50 border-amber-300 text-amber-700'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            <FiFlag className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon={FiInbox}
                title="No high-priority feedback yet"
                description="When customers send urgent or negative feedback, it will appear here so your team can respond quickly."
                primaryLabel="Import sample feedback"
                primaryOnClick={() => {
                  // Placeholder for future import flow
                  console.log('Import feedback clicked')
                }}
                secondaryLabel={isAdminUser ? 'Connect a channel' : undefined}
                secondaryOnClick={
                  isAdminUser
                    ? () => {
                        // Placeholder for future channel connection
                        console.log('Connect channel clicked')
                      }
                    : undefined
                }
              />
            )}
          </div>

          {/* Recent Feedback */}
          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Recent Feedback</h2>
              {unreadRecentIds.size > 0 && (
                <span className="inline-flex items-center rounded-full bg-[#009750]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#009750]">
                  New {unreadRecentIds.size}
                </span>
              )}
            </div>
            {selectedIds.size > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-[36px] items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                  onClick={() => {
                    const items = visibleRecentFeedback.filter((it) => selectedIds.has(it.id))
                    batchUpdateStatus(items, 'Resolved')
                  }}
                >
                  <FiCheckCircle className="w-4 h-4 mr-1.5" />
                  Resolve selected
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-[36px] items-center rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900"
                  onClick={() => {
                    const items = visibleRecentFeedback.filter((it) => selectedIds.has(it.id))
                    batchUpdateStatus(items, 'Archived')
                  }}
                >
                  <FiArchive className="w-4 h-4 mr-1.5" />
                  Archive selected
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-[36px] items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  onClick={clearSelection}
                >
                  Clear selection
                </button>
              </div>
            )}
            {inboxLoading || !inboxDelayPassed ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-50 rounded-lg border border-gray-200 p-5 animate-pulse"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center flex-wrap gap-2">
                        <div className="h-5 w-16 bg-gray-100 rounded-full" />
                        <div className="h-5 w-20 bg-gray-100 rounded-full" />
                        <div className="h-5 w-16 bg-gray-100 rounded-full" />
                      </div>
                      <div className="h-3 w-16 bg-gray-100 rounded" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 w-full bg-gray-100 rounded" />
                      <div className="h-3 w-5/6 bg-gray-100 rounded" />
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="h-3 w-24 bg-gray-100 rounded" />
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-10 bg-gray-100 rounded-full" />
                        <div className="h-6 w-10 bg-gray-100 rounded-full" />
                        <div className="h-6 w-8 bg-gray-100 rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : visibleRecentFeedback.length > 0 ? (
              <div className="space-y-4">
                {visibleRecentFeedback.slice(0, 10).map((item) => {
                  const status = getStatus(item)
                  const r = reactionsById[item.id] || {
                    thumbsUp: false,
                    thumbsDown: false,
                    flagged: false,
                  }
                  return (
                    <div
                      key={item.id}
                      className="bg-gray-50 rounded-lg border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all duration-200 cursor-pointer"
                      onClick={() => openFeedbackModal(item)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <label
                          className="inline-flex items-center gap-2 text-xs text-gray-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelected(item.id)}
                            className="h-4 w-4 rounded border-gray-300 text-[#009750] focus:ring-[#009750]/50"
                          />
                          Select
                        </label>
                      </div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center flex-wrap gap-2">
                          <span
                            className={`px-3 py-1 rounded-md text-xs font-semibold ${
                              item.sentiment_label === 'negative'
                                ? 'bg-red-100 text-red-700'
                                : item.sentiment_label === 'positive'
                                ? 'bg-[#009750]/10 text-[#009750]'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {formatSentimentWord(item.sentiment_label)}
                          </span>
                          {item.category && (
                            <span className="px-3 py-1 rounded-md text-xs bg-blue-100 text-blue-700">
                              {item.category}
                            </span>
                          )}
                          {item.rating && (
                            <span className="px-3 py-1 rounded-md text-xs bg-purple-100 text-purple-700">
                              Rating {item.rating}/5
                            </span>
                          )}
                          <span
                            className={`px-3 py-1 rounded-md text-xs font-semibold ${getStatusClasses(
                              status
                            )}`}
                          >
                            {status}
                          </span>
                        </div>
                        <span
                          className="text-xs text-gray-500 font-medium text-right shrink-0 max-w-[9rem] sm:max-w-none"
                          title={
                            item.created_at
                              ? new Date(item.created_at).toLocaleString()
                              : undefined
                          }
                        >
                          {item.created_at ? (
                            <>
                              <span className="block sm:inline">
                                {formatRelativeTime(item.created_at)}
                              </span>
                              <span className="hidden sm:inline text-gray-400"> · </span>
                              <span className="block sm:inline text-gray-400">
                                {new Date(item.created_at).toLocaleDateString()}
                              </span>
                            </>
                          ) : (
                            ''
                          )}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed line-clamp-3">
                        {item.message || 'No message'}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-3">
                        {item.source && (
                          <p className="text-xs text-gray-500">
                            <span className="font-medium text-gray-600">Source:</span> {item.source}
                          </p>
                        )}
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setReaction(item.id, 'thumbsUp')}
                            className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[11px] ${
                              r.thumbsUp
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            <FiThumbsUp className="w-3 h-3 mr-1" />
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() => setReaction(item.id, 'thumbsDown')}
                            className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[11px] ${
                              r.thumbsDown
                                ? 'bg-red-50 border-red-300 text-red-700'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            <FiThumbsDown className="w-3 h-3 mr-1" />
                            Down
                          </button>
                          <button
                            type="button"
                            onClick={() => setReaction(item.id, 'flag')}
                            className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[11px] ${
                              r.flagged
                                ? 'bg-amber-50 border-amber-300 text-amber-700'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            <FiFlag className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon={FiInbox}
                title="No feedback yet"
                description={
                  isAdminUser
                    ? 'Once your email, WhatsApp, and social channels are connected, new customer messages will stream into this inbox.'
                    : 'New customer messages will show here as your team receives them. A user with integration access can set up webhooks and channels in Admin → Webhooks & channels.'
                }
                primaryLabel={isAdminUser ? 'Connect email or WhatsApp' : 'Refresh'}
                primaryOnClick={() => {
                  if (isAdminUser) {
                    console.log('Connect email/WhatsApp clicked')
                    return
                  }
                  reloadDashboardRef.current?.()
                }}
                primaryIcon={isAdminUser ? FiUploadCloud : FiRefreshCw}
                secondaryLabel={isAdminUser ? 'Import historical feedback' : undefined}
                secondaryOnClick={
                  isAdminUser
                    ? () => {
                        console.log('Import historical feedback clicked')
                      }
                    : undefined
                }
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard
