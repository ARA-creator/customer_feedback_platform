import { useState, useEffect, useMemo, useRef } from 'react'
import {
  FiThumbsUp,
  FiThumbsDown,
  FiAlertTriangle,
  FiFlag,
  FiCheckCircle,
  FiArchive,
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
import { SENTIMENT_COLORS, CHART_PALETTE } from '../constants/palette'
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
import DashboardInsightsSection from './DashboardInsightsSection'
import DashboardInboxSection from './DashboardInboxSection'
import FeedbackDetailModal from './FeedbackDetailModal'
import { DashboardProvider } from '../context/DashboardContext'
import { useDashboardController } from '../hooks/useDashboardController'
import { useInboxSelection } from '../hooks/useInboxSelection'
import { useInboxReactions } from '../hooks/useInboxReactions'
import { useInboxStatus } from '../hooks/useInboxStatus'

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
  const { selectedIds, toggleSelected, clearSelection, batchUpdateStatus } = useInboxSelection({
    setStatusById,
  })
  const { setReaction } = useInboxReactions({ setReactionsById })
  const { getStatus, updateStatus, getStatusClasses } = useInboxStatus({
    statusById,
    setStatusById,
  })
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

  const closeFeedbackModal = () => {
    setIsDetailOpen(false)
    setSelectedFeedback(null)
  }

  const controller = useDashboardController({
    // identity
    mode,
    isAdminUser,
    userRole,

    // loading/error
    loading,
    analyticsLoading,
    inboxLoading,
    error,
    lastUpdated,

    // analytics
    metrics,
    sentimentData,
    categoryData,
    trendData,
    comparison,
    responseMetrics,
    peakTimes,
    scoreHistogram,
    categoryTrends,
    productPulse,
    productPulseTrends,
    insuranceTagsBreakdown,
    insuranceTagsTrends,
    sourceTrends,
    sourcePerformance,

    // inbox lists
    recentFeedback,
    priorityQueue,

    // modal state
    selectedFeedback,
    isDetailOpen,

    // actions
    reload: () => reloadDashboardRef.current?.(),
    refreshSilent: () => refreshDashboardSilentRef.current?.(),
    navigateToInbox: onNavigateToInbox,
    navigateToInsights: onNavigateToInsights,
    navigateBack: onNavigateBack,
    openFeedback: openFeedbackModal,
    closeFeedback: closeFeedbackModal,
  })

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
    <DashboardProvider data={controller.data} actions={controller.actions}>
      <div className="relative p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 mx-auto max-w-7xl">
      <FeedbackDetailModal
        open={isDetailOpen && !!selectedFeedback}
        feedback={selectedFeedback}
        reactionsById={reactionsById}
        onClose={closeFeedbackModal}
        onUpdateStatus={updateStatus}
        onSetReaction={setReaction}
        getStatus={getStatus}
        getStatusClasses={getStatusClasses}
        safeParseJson={safeParseJson}
        formatSentimentWord={formatSentimentWord}
      />
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
              className="inline-flex items-center justify-center min-h-[44px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-[#009750]/30"
            >
              <FiRefreshCw className="h-4 w-4 mr-1.5" />
              Refresh
            </button>
            {isAdminUser && (
              <label className="inline-flex items-center gap-2 min-h-[44px] cursor-pointer select-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 focus-within:ring-2 focus-within:ring-[#009750]/30">
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
                className="inline-flex items-center justify-center min-h-[44px] rounded-xl bg-[#009750] px-3.5 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#007a42] transition-colors focus:outline-none focus:ring-2 focus:ring-[#009750]/30"
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
              <div className="mb-4 flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300 shrink-0">Filter by:</span>
                <div className="-mx-1 flex w-full flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1 [-webkit-overflow-scrolling:touch]">
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
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[40px] ${
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
            <DashboardInsightsSection
              onNavigateBack={onNavigateBack}
              onNavigateToInbox={onNavigateToInbox}
              insightsProductKey={insightsProductKey}
              setInsightsProductKey={setInsightsProductKey}
              insightsProductOptions={insightsProductOptions}
              insightsRange={insightsRange}
              setInsightsRange={setInsightsRange}
              analyticsLoading={analyticsLoading}
              analyticsDelayPassed={analyticsDelayPassed}
              isDarkMode={isDarkMode}
              productPulseTrendPivot={productPulseTrendPivot}
              categoryTrendPivot={categoryTrendPivot}
              insuranceTagsBreakdown={insuranceTagsBreakdown}
              sourceTrends={sourceTrends}
              sourceTrendColors={sourceTrendColors}
              peakTimes={peakTimes}
              peakTimesTotalCount={peakTimesTotalCount}
              peakTimesMaxCount={peakTimesMaxCount}
              heatmapHover={heatmapHover}
              setHeatmapHover={setHeatmapHover}
            />
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
        <DashboardInboxSection
          inboxHasActiveFilters={inboxHasActiveFilters}
          inboxActiveFilterLabels={inboxActiveFilterLabels}
          handleQuickFilter={handleQuickFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedSavedView={selectedSavedView}
          setSelectedSavedView={setSelectedSavedView}
          savedViews={savedViews}
          sentimentFilter={sentimentFilter}
          setSentimentFilter={setSentimentFilter}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          categoryOptions={categoryOptions}
          dateRange={dateRange}
          setDateRange={setDateRange}
          customDateFrom={customDateFrom}
          setCustomDateFrom={setCustomDateFrom}
          customDateTo={customDateTo}
          setCustomDateTo={setCustomDateTo}
          sourceTabs={sourceTabs}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
          sourceTabCounts={sourceTabCounts}
          SourceLogo={SourceLogo}
          unreadPriorityIds={unreadPriorityIds}
          selectedIds={selectedIds}
          visiblePriorityQueue={visiblePriorityQueue}
          reactionsById={reactionsById}
          getStatus={getStatus}
          getStatusClasses={getStatusClasses}
          openFeedbackModal={openFeedbackModal}
          toggleSelected={toggleSelected}
          setReaction={setReaction}
          formatRelativeTime={formatRelativeTime}
          formatSentimentWord={formatSentimentWord}
          SourcePill={SourcePill}
          inboxLoading={inboxLoading}
          inboxDelayPassed={inboxDelayPassed}
          batchUpdateStatus={batchUpdateStatus}
          clearSelection={clearSelection}
          FiCheckCircle={FiCheckCircle}
          FiArchive={FiArchive}
          FiInbox={FiInbox}
          FiUploadCloud={FiUploadCloud}
          FiRefreshCw={FiRefreshCw}
          FiThumbsUp={FiThumbsUp}
          FiThumbsDown={FiThumbsDown}
          FiFlag={FiFlag}
          isAdminUser={isAdminUser}
          reloadDashboardRef={reloadDashboardRef}
          unreadRecentIds={unreadRecentIds}
          visibleRecentFeedback={visibleRecentFeedback}
        />
      )}
      </div>
    </DashboardProvider>
  )
}

export default Dashboard
