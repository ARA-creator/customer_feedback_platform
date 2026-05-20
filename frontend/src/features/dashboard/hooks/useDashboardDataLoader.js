import { useEffect } from 'react'
import { CHART_PALETTE, SENTIMENT_COLORS } from '../constants/palette'
import { formatCategoryChartLabel } from '../utils/dashboardFormatters'
import { formatDashboardLoadError } from '../utils/dashboardLoadError'

export function useDashboardDataLoader({
  // identity / flags
  mode,
  insightsRange,
  insightsProductParams,
  overviewTimeFilter,
  isAdminUser,
  dashboardAutoRefresh,

  // APIs
  getAnalytics,
  getRecentFeedback,
  getPriorityQueue,
  getProductPulse,
  getProductPulseTrend,
  USE_DEV_API_PROXY,

  // state setters
  setLoading,
  setAnalyticsLoading,
  setInboxLoading,
  setError,
  setLastUpdated,
  setMetrics,
  setSentimentData,
  setCategoryData,
  setTrendData,
  setResponseMetrics,
  setPeakTimes,
  setScoreHistogram,
  setCategoryTrends,
  setSourceTrends,
  setSourcePerformance,
  setInsuranceTagsBreakdown,
  setInsuranceTagsTrends,
  setProductPulse,
  setProductPulseTrends,
  setRecentFeedback,
  setPriorityQueue,

  // refs to expose actions
  analyticsDataRef,
  reloadDashboardRef,
  refreshDashboardSilentRef,
}) {
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
        setSentimentData(sentimentChartData)

        const categories = analyticsData.categories || {}
        const categoryChartData = Object.entries(categories)
          .map(([name, value]) => ({
            name: formatCategoryChartLabel(name),
            value: Number(value),
          }))
          .sort((a, b) => b.value - a.value)
          .map((row, i) => ({
            ...row,
            fill: CHART_PALETTE[i % CHART_PALETTE.length],
          }))
        setCategoryData(categoryChartData)

        setTrendData(analyticsData.trends || [])
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
                sources: Array.isArray(analyticsData.source_trends.sources) ? analyticsData.source_trends.sources : [],
                data: Array.isArray(analyticsData.source_trends.data) ? analyticsData.source_trends.data : [],
              }
            : { sources: [], data: [] },
        )
        setSourcePerformance(analyticsData.source_performance || [])
        setInsuranceTagsBreakdown(
          analyticsData.insurance_tags_breakdown && typeof analyticsData.insurance_tags_breakdown === 'object'
            ? analyticsData.insurance_tags_breakdown
            : {},
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
                  : overviewTimeFilter === 'last_week'
                    ? 7
                    : overviewTimeFilter === 'month'
                      ? 30
                      : 30
          const pulseParams =
            mode === 'insights'
              ? { range_days: rangeDays, ...insightsProductParams }
              : { time_window: overviewTimeFilter }
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
          }).catch(() => ({ trends: [] }))
          if (!cancelled) setProductPulseTrends(Array.isArray(pt?.trends) ? pt.trends : [])
        } else if (!cancelled) {
          setProductPulseTrends([])
        }

        if (!isSilent) setAnalyticsLoading(false)

        const [recentData, priorityData] = await Promise.all([
          getRecentFeedback(100).catch(() => ({ feedback: [] })),
          getPriorityQueue(50).catch(() => ({ feedback: [] })),
        ])
        if (cancelled) return

        setRecentFeedback(recentData.feedback || [])
        setPriorityQueue(priorityData.feedback || [])

        if (!isSilent) setInboxLoading(false)
        setError(null)
        setLastUpdated(new Date())
      } catch (err) {
        if (cancelled) return
        console.error('Error fetching analytics:', err)
        if (!isSilent) {
          setError(formatDashboardLoadError(err, { useDevProxy: USE_DEV_API_PROXY }))
          setSentimentData([])
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
  }, [
    mode,
    insightsRange,
    insightsProductParams,
    overviewTimeFilter,
    isAdminUser,
    dashboardAutoRefresh,
    getAnalytics,
    getRecentFeedback,
    getPriorityQueue,
    getProductPulse,
    getProductPulseTrend,
    USE_DEV_API_PROXY,
    setLoading,
    setAnalyticsLoading,
    setInboxLoading,
    setError,
    setLastUpdated,
    setMetrics,
    setSentimentData,
    setCategoryData,
    setTrendData,
    setResponseMetrics,
    setPeakTimes,
    setScoreHistogram,
    setCategoryTrends,
    setSourceTrends,
    setSourcePerformance,
    setInsuranceTagsBreakdown,
    setInsuranceTagsTrends,
    setProductPulse,
    setProductPulseTrends,
    setRecentFeedback,
    setPriorityQueue,
    analyticsDataRef,
    reloadDashboardRef,
    refreshDashboardSilentRef,
  ])
}

