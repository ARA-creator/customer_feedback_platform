import { useState, useEffect, useMemo, useRef } from 'react'
import {
  FiThumbsUp,
  FiThumbsDown,
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
  FiCalendar,
  FiBarChart2,
  FiMinus,
} from 'react-icons/fi'
import {
  getAnalytics,
  getFeedbackAnalyzer,
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
import { safeParseJson } from '../utils/dashboardHelpers'
import { buildSourceTrendColorMap } from '../utils/dashboardCharts'
import {
  computeKpiTrackPercent,
  computeTrendYStats,
  getOverviewThemesCaption,
  getOverviewTimeFilterLabel,
} from '../utils/dashboardDerived'
import OverviewMetricCards from './OverviewMetricCards'
import OverviewChartsSection from './OverviewChartsSection'
import OverviewWordCloudAndSource from './OverviewWordCloudAndSource'
import DashboardInsightsSection from './DashboardInsightsSection'
import DashboardInboxSection from './DashboardInboxSection'
import FeedbackDetailModal from './FeedbackDetailModal'
import DashboardTopBar from './DashboardTopBar'
import OverviewTimeFilterRow from './OverviewTimeFilterRow'
import FeedbackAnalyzerModal from './FeedbackAnalyzerModal'
import { DashboardProvider } from '../context/DashboardContext'
import { useDashboardController } from '../hooks/useDashboardController'
import { useInboxSelection } from '../hooks/useInboxSelection'
import { useInboxReactions } from '../hooks/useInboxReactions'
import { useInboxStatus } from '../hooks/useInboxStatus'
import { ToastStack } from '../../../shared/components/ui'
import { useToasts } from '../hooks/useToasts'
import { useInboxSourceCounts } from '../hooks/useInboxSourceCounts'
import {
  useInsightsProductOptions,
  useInsightsProductParams,
} from '../hooks/useInsightsProductOptions'
import { useDashboardDataLoader } from '../hooks/useDashboardDataLoader'
import { useDashboardSse } from '../hooks/useDashboardSse'
import { useInboxFilteredLists } from '../hooks/useInboxFilteredLists'
import { filterFeedbackItems } from '../utils/dashboardInboxFilters'
import { useSourceTabCounts } from '../hooks/useSourceTabCounts'
import { buildDashboardSummaryCsv, buildInboxFeedbackCsv, downloadTextFile } from '../utils/dashboardExport'
import { getQuickFilterPatch } from '../utils/dashboardInboxQuickFilters'
import { buildInboxActiveFilterLabels } from '../utils/dashboardInboxFilterLabels'
import { SAVED_VIEWS } from '../utils/dashboardSavedViews'
import { computePeakTimesTotals, pivotCategoryTrends, pivotProductPulseTrends } from '../utils/dashboardPivots'
import { buildThemesBarChartData, sentimentChartHasRealData as sentimentChartHasRealDataFn, themesChartHasRealData } from '../utils/dashboardChartData'
import { useDashboardActions } from '../hooks/useDashboardActions'
import { useDashboardExports } from '../hooks/useDashboardExports'
import { useDashboardAutoRefresh } from '../hooks/useDashboardAutoRefresh'
import { useInboxQuickFilters } from '../hooks/useInboxQuickFilters'
import { useFeedbackDetailModal } from '../hooks/useFeedbackDetailModal'

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
  registerRefresh,
}) {
  const isDarkMode =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

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
  const [trendData, setTrendData] = useState([])
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
  const [unreadPriorityIds, setUnreadPriorityIds] = useState(new Set())
  const [unreadRecentIds, setUnreadRecentIds] = useState(new Set())
  const { pushToast, toastStackProps } = useToasts({ defaultTtlMs: 5000 })
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
  const { dashboardAutoRefresh, setDashboardAutoRefresh, dashboardAutoRefreshRef } = useDashboardAutoRefresh({
    isAdminUser,
    storageKey: DASHBOARD_AUTO_REFRESH_KEY,
  })
  const analyticsDataRef = useRef(null)
  const [serverSourceCounts, setServerSourceCounts] = useState(null)
  const [insightsRange, setInsightsRange] = useState(30) // Insights (all cards): 7/30/90
  /** `prefix|group` from product pulse (empty = all products) */
  const [insightsProductKey, setInsightsProductKey] = useState('')
  const [insightsProductOptions, setInsightsProductOptions] = useState(() => [])
  /** Overview dashboard time scope: matches GET /api/analytics?time_window= */
  const [overviewTimeFilter, setOverviewTimeFilter] = useState('all') // all | today | week | last_week | month
  const [analyzerOpen, setAnalyzerOpen] = useState(false)
  const [analyzerLoading, setAnalyzerLoading] = useState(false)
  const [analyzerResult, setAnalyzerResult] = useState(null)
  const [analyzerError, setAnalyzerError] = useState(null)

  const { selectedFeedback, isDetailOpen, openFeedbackModal, closeFeedbackModal } = useFeedbackDetailModal({
    unreadPriorityIds,
    setUnreadPriorityIds,
    unreadRecentIds,
    setUnreadRecentIds,
  })

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

  const insightsProductParams = useInsightsProductParams(insightsProductKey)
  useInsightsProductOptions({
    enabled: mode === 'insights',
    getProductPulse,
    insightsRange,
    insightsProductKey,
    setInsightsProductKey,
    setInsightsProductOptions,
    insightsProductOptions,
  })

  const [heatmapHover, setHeatmapHover] = useState(null)

  /** Subtitle/empty copy for the overview Insurance tags chart (aligns with API window). */
  const overviewInsuranceTagsCaption = useMemo(() => {
    return getOverviewThemesCaption(overviewTimeFilter)
  }, [overviewTimeFilter])

  /** Share of total feedback for KPI bottom track (0–100). */
  const kpiTrackPercent = useMemo(() => computeKpiTrackPercent(metrics), [metrics])

  const { trendYMax, trendAllZero } = useMemo(() => computeTrendYStats(trendData), [trendData])

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
    if (!registerRefresh) return undefined
    registerRefresh(() => {
      reloadDashboardRef.current?.()
    })
    return () => registerRefresh(null)
  }, [registerRefresh])

  useEffect(() => {
    if (mode !== 'inbox') return
    const s = inboxPreset?.sentiment ?? 'all'
    const p = inboxPreset?.priority ?? 'all'
    setSentimentFilter(s)
    setPriorityFilter(p)
  }, [mode, inboxPreset?.sentiment, inboxPreset?.priority])

  useInboxSourceCounts({
    enabled: mode === 'inbox',
    getSourceCounts,
    setServerSourceCounts,
    sentimentFilter,
    categoryFilter,
    priorityFilter,
    dateRange,
    customDateFrom,
    customDateTo,
  })

  const { navigateToInboxPreset, handleScheduleReports, handleOpenCustomReportBuilder } = useDashboardActions({
    onNavigateToInbox,
    onNavigateScheduleReport,
    onNavigateCustomReport,
    pushToast,
  })

  const sourceTrendColors = useMemo(() => buildSourceTrendColorMap(sourceTrends), [sourceTrends])

  useDashboardDataLoader({
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
    getClipboardBackendOrigin,
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
  })

  useDashboardSse({
    getBackendOrigin,
    mode,
    dashboardAutoRefreshRef,
    analyticsSseDebounceRef,
    refreshDashboardSilentRef,
    getRecentFeedback,
    getPriorityQueue,
    setRecentFeedback,
    setPriorityQueue,
    pushToast,
    setUnreadPriorityIds,
    setUnreadRecentIds,
  })

  const inboxFilters = useMemo(
    () => ({
      searchQuery,
      sentimentFilter,
      sourceFilter,
      categoryFilter,
      priorityFilter,
      dateRange,
      customDateFrom,
      customDateTo,
    }),
    [searchQuery, sentimentFilter, sourceFilter, categoryFilter, priorityFilter, dateRange, customDateFrom, customDateTo],
  )

  const {
    allFeedback,
    sourceTabs,
    categoryOptions,
    filteredPriorityQueue,
    filteredRecentFeedback,
    visiblePriorityQueue,
    visibleRecentFeedback,
  } = useInboxFilteredLists({
    recentFeedback,
    priorityQueue,
    filters: inboxFilters,
    getStatus,
  })

  const { total: peakTimesTotalCount, max: peakTimesMaxCount } = useMemo(
    () => computePeakTimesTotals(peakTimes),
    [peakTimes],
  )

  const categoryTrendPivot = useMemo(() => pivotCategoryTrends(categoryTrends, { topN: 6 }), [categoryTrends])

  /** Daily counts per product (primary policy match) — same shape as category trends for LineChart */
  const productPulseTrendPivot = useMemo(
    () => pivotProductPulseTrends(productPulseTrends, { topN: 6 }),
    [productPulseTrends],
  )

  const sourceTabCounts = useSourceTabCounts({
    mode,
    serverSourceCounts,
    recentFeedback,
    priorityQueue,
    inboxFilters,
    getStatus,
  })
  const overviewTimeFilterLabel = useMemo(
    () => getOverviewTimeFilterLabel(overviewTimeFilter),
    [overviewTimeFilter],
  )

  const handleOpenAnalyzer = async () => {
    setAnalyzerOpen(true)
    setAnalyzerLoading(true)
    setAnalyzerError(null)
    setAnalyzerResult(null)
    try {
      const data = await getFeedbackAnalyzer({ time_window: overviewTimeFilter })
      setAnalyzerResult(data)
    } catch (err) {
      const msg =
        err?.response?.data?.error || err?.message || 'Could not analyze feedback for this period.'
      setAnalyzerError(msg)
      pushToast?.('Analyzer failed', msg, 'error')
    } finally {
      setAnalyzerLoading(false)
    }
  }

  const handleCloseAnalyzer = () => {
    setAnalyzerOpen(false)
  }

  const { exportOverviewCsv: handleExportCsv, exportInboxCsv: handleExportCSV } = useDashboardExports({
    metrics,
    sentimentData,
    categoryData,
    trendData,
    recentFeedback,
    priorityQueue,
    buildDashboardSummaryCsv,
    buildInboxFeedbackCsv,
    downloadTextFile,
    pushToast,
  })

  const [selectedSavedView, setSelectedSavedView] = useState('all')
  const { handleQuickFilter, inboxActiveFilterLabels, inboxHasActiveFilters, savedViews } = useInboxQuickFilters({
    mode,
    searchQuery,
    setSearchQuery,
    sentimentFilter,
    setSentimentFilter,
    sourceFilter,
    setSourceFilter,
    categoryFilter,
    setCategoryFilter,
    priorityFilter,
    setPriorityFilter,
    dateRange,
    setDateRange,
    customDateFrom,
    setCustomDateFrom,
    customDateTo,
    setCustomDateTo,
    buildInboxActiveFilterLabels,
    getQuickFilterPatch,
    SAVED_VIEWS,
  })

  const sentimentChartHasRealData = useMemo(() => sentimentChartHasRealDataFn(sentimentData), [sentimentData])

  const insuranceTagsBarChartData = useMemo(
    () => buildThemesBarChartData({ insuranceTagsBreakdown, chartPalette: CHART_PALETTE }),
    [insuranceTagsBreakdown],
  )

  const categoryChartHasRealData = useMemo(() => themesChartHasRealData(insuranceTagsBreakdown), [insuranceTagsBreakdown])

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
      <DashboardTopBar
        mode={mode}
        loading={loading}
        analyticsDelayPassed={analyticsDelayPassed}
        lastUpdated={lastUpdated}
        error={error}
        formatRelativeTime={formatRelativeTime}
        isAdminUser={isAdminUser}
        dashboardAutoRefresh={dashboardAutoRefresh}
        dashboardAutoRefreshKey={DASHBOARD_AUTO_REFRESH_KEY}
        onToggleAutoRefresh={(on) => {
          setDashboardAutoRefresh(on)
        }}
        onRefresh={() => reloadDashboardRef.current?.()}
      />

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
              <OverviewTimeFilterRow
                value={overviewTimeFilter}
                onChange={setOverviewTimeFilter}
                onAnalyzer={handleOpenAnalyzer}
                analyzerDisabled={loading || !analyticsDelayPassed}
                analyzerLoading={analyzerLoading}
                onExportCsv={handleExportCsv}
                exportDisabled={loading || !analyticsDelayPassed}
                isAdminUser={isAdminUser}
                dashboardAutoRefresh={dashboardAutoRefresh}
                onToggleAutoRefresh={setDashboardAutoRefresh}
              />
              <FeedbackAnalyzerModal
                open={analyzerOpen}
                onClose={handleCloseAnalyzer}
                loading={analyzerLoading}
                error={analyzerError}
                result={analyzerResult}
                timeFilterLabel={overviewTimeFilterLabel}
              />

          <OverviewMetricCards
            metrics={metrics}
            kpiTrackPercent={kpiTrackPercent}
            analyticsLoading={analyticsLoading}
            analyticsDelayPassed={analyticsDelayPassed}
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
              trendData={trendData}
              metrics={metrics}
              productPulseTrendPivot={productPulseTrendPivot}
              insuranceTagsBreakdown={insuranceTagsBreakdown}
              categoryData={categoryData}
              sourceTrends={sourceTrends}
              sourceTrendColors={sourceTrendColors}
              sourcePerformance={sourcePerformance}
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
      <ToastStack {...toastStackProps} />

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
