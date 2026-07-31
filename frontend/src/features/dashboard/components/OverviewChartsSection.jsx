import { useEffect, useMemo, useState } from 'react'
import AiInsightBar from './overview/AiInsightBar'
import SentimentBreakdownCard from './overview/SentimentBreakdownCard'
import RecentFeedbackCard from './overview/RecentFeedbackCard'
import TopFeedbackTopicsCard from './overview/TopFeedbackTopicsCard'
import SentimentTrendCard from './overview/SentimentTrendCard'
import VolumeByChannelCard from './overview/VolumeByChannelCard'
import ProductBreakdownCard from './overview/ProductBreakdownCard'
import {
  buildChannelDonutData,
  buildProductBreakdownRows,
  buildProductFilterOptions,
  buildTopicsTableRows,
} from './overview/chartUi'

/**
 * Overview dashboard — mockup-style chart grid + AI insight bar.
 */
export default function OverviewChartsSection({
  isCx,
  analyticsLoading,
  analyticsDelayPassed,
  sentimentChartHasRealData,
  sentimentData,
  insuranceTagsBreakdown,
  isDarkMode: _isDarkMode,
  trendData,
  trendAllZero,
  overviewTrendLabels,
  sourcePerformance,
  productPulse = [],
  recentFeedback = [],
  overviewSentimentFilter = 'all',
  recentFeedbackLoading = false,
  navigateToInboxPreset,
  onNavigateToInsights,
  onNavigateToInbox,
  onOpenFeedback,
  analyzerLoading,
  analyzerError,
  analyzerResult,
  overviewTimeFilterLabel,
  overviewTimeFilter = 'all',
  onAnalyzerRefresh,
  onAnalyzerDetails,
  analyzerRefreshDisabled,
}) {
  const trendTitle = overviewTrendLabels?.title || 'Sentiment Trend'
  const allChannelRows = buildChannelDonutData(sourcePerformance)
  const [channelFilter, setChannelFilter] = useState('all')
  const [productFilter, setProductFilter] = useState('all')
  const [showAllProducts, setShowAllProducts] = useState(false)

  useEffect(() => {
    if (channelFilter === 'all') return
    if (!allChannelRows.some((r) => r.source === channelFilter)) {
      setChannelFilter('all')
    }
  }, [allChannelRows, channelFilter])

  const channelFilterOptions = useMemo(
    () => [
      { id: 'all', label: 'All channels' },
      ...allChannelRows.map((r) => ({ id: r.source, label: r.name })),
    ],
    [allChannelRows],
  )

  const channelRows = useMemo(() => {
    if (channelFilter === 'all') return allChannelRows
    return allChannelRows.filter((r) => r.source === channelFilter)
  }, [allChannelRows, channelFilter])

  const channelTotal = channelRows.reduce((s, r) => s + r.value, 0)
  const productFilterOptions = useMemo(() => buildProductFilterOptions(productPulse), [productPulse])
  const productRows = useMemo(
    () =>
      buildProductBreakdownRows(productPulse, {
        limit: showAllProducts ? 1000 : 5,
        filterKey: productFilter,
      }),
    [productPulse, productFilter, showAllProducts],
  )

  const productPulseCount = useMemo(
    () => (Array.isArray(productPulse) ? productPulse.filter((r) => (Number(r?.total) || 0) > 0).length : 0),
    [productPulse],
  )

  useEffect(() => {
    if (productFilter === 'all') return
    if (!productPulse.some((r) => r.key === productFilter)) {
      setProductFilter('all')
    }
  }, [productPulse, productFilter])

  const topics = buildTopicsTableRows(insuranceTagsBreakdown, { limit: 5 })
  const ready = !analyticsLoading && analyticsDelayPassed

  const openInboxWithOverviewSentiment = () => {
    if (navigateToInboxPreset) {
      navigateToInboxPreset({ sentiment: overviewSentimentFilter || 'all', priority: 'all' })
      return
    }
    onNavigateToInbox?.()
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Sentiment trend */}
      <SentimentTrendCard
        ready={ready}
        trendTitle={trendTitle}
        trendData={trendData}
        trendAllZero={trendAllZero}
        overviewTrendLabels={overviewTrendLabels}
        onNavigateToInsights={onNavigateToInsights}
      />

      {/* Row 2: Volume by channel + Product breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VolumeByChannelCard
          ready={ready}
          channelRows={channelRows}
          channelTotal={channelTotal}
          channelFilter={channelFilter}
          onChannelFilterChange={setChannelFilter}
          channelFilterOptions={channelFilterOptions}
        />

        <ProductBreakdownCard
          ready={ready}
          rows={productRows}
          productFilter={productFilter}
          onProductFilterChange={setProductFilter}
          productFilterOptions={productFilterOptions}
          showAllProducts={showAllProducts}
          timeWindow={overviewTimeFilter}
          timeFilterLabel={overviewTimeFilterLabel}
          onViewAllProducts={
            productPulseCount > 5
              ? () => setShowAllProducts((v) => !v)
              : undefined
          }
        />
      </div>

      {/* Row 3: Topics + Recent + Sentiment breakdown */}
      <div className={`grid grid-cols-1 gap-6 ${isCx ? 'lg:grid-cols-2' : 'xl:grid-cols-3'}`}>
        {!isCx && (
          <TopFeedbackTopicsCard
            ready={ready}
            topics={topics}
            onViewAllTopics={onNavigateToInsights ? () => onNavigateToInsights() : undefined}
          />
        )}

        <div className={isCx ? 'lg:col-span-1' : ''}>
          <RecentFeedbackCard
            ready={ready}
            listLoading={recentFeedbackLoading}
            recentFeedback={recentFeedback}
            sentimentFilter={overviewSentimentFilter}
            onViewAll={navigateToInboxPreset || onNavigateToInbox ? openInboxWithOverviewSentiment : onNavigateToInsights}
            onViewAllFeedback={navigateToInboxPreset || onNavigateToInbox ? openInboxWithOverviewSentiment : onNavigateToInsights}
            onOpenFeedback={onOpenFeedback}
          />
        </div>

        <SentimentBreakdownCard
          ready={ready}
          sentimentChartHasRealData={sentimentChartHasRealData}
          sentimentData={sentimentData}
          trendData={trendData}
        />
      </div>

      {/* AI Insight — full width below charts */}
      <AiInsightBar
        loading={analyzerLoading}
        error={analyzerError}
        result={analyzerResult}
        timeFilterLabel={overviewTimeFilterLabel}
        onRefresh={onAnalyzerRefresh}
        onViewDetails={onAnalyzerDetails}
        refreshDisabled={analyzerRefreshDisabled}
      />
    </div>
  )
}
