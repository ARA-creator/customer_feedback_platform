import { useMemo, useState } from 'react'
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
  const channelRows = buildChannelDonutData(sourcePerformance)
  const [showAllProducts, setShowAllProducts] = useState(false)
  const [showAllTopics, setShowAllTopics] = useState(false)

  const channelTotal = channelRows.reduce((s, r) => s + r.value, 0)
  const productRows = useMemo(
    () =>
      buildProductBreakdownRows(productPulse, {
        limit: showAllProducts ? 1000 : 5,
        filterKey: 'all',
      }),
    [productPulse, showAllProducts],
  )

  const productPulseCount = useMemo(
    () => (Array.isArray(productPulse) ? productPulse.filter((r) => (Number(r?.total) || 0) > 0).length : 0),
    [productPulse],
  )
  const hasMoreProducts = productPulseCount > 5

  const topics = useMemo(
    () => buildTopicsTableRows(insuranceTagsBreakdown, { limit: showAllTopics ? 1000 : 5 }),
    [insuranceTagsBreakdown, showAllTopics],
  )
  const topicCount = useMemo(() => {
    const b = insuranceTagsBreakdown && typeof insuranceTagsBreakdown === 'object' ? insuranceTagsBreakdown : {}
    return Object.values(b).filter((stats) => (Number(stats?.total) || 0) > 0).length
  }, [insuranceTagsBreakdown])
  const hasMoreTopics = topicCount > 5
  const ready = !analyticsLoading && analyticsDelayPassed

  const openInboxWithOverviewSentiment = () => {
    if (navigateToInboxPreset) {
      navigateToInboxPreset({
        sentiment: overviewSentimentFilter || 'all',
        priority: 'all',
      })
      return
    }
    onNavigateToInbox?.()
  }

  return (
    <div className="space-y-6">
      <AiInsightBar
        loading={analyzerLoading}
        error={analyzerError}
        result={analyzerResult}
        timeFilterLabel={overviewTimeFilterLabel}
        onRefresh={onAnalyzerRefresh}
        onViewDetails={onAnalyzerDetails}
        refreshDisabled={analyzerRefreshDisabled}
      />

      <SentimentTrendCard
        ready={ready}
        trendTitle={trendTitle}
        trendData={trendData}
        trendAllZero={trendAllZero}
        overviewTrendLabels={overviewTrendLabels}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VolumeByChannelCard
          ready={ready}
          channelRows={channelRows}
          channelTotal={channelTotal}
        />

        <ProductBreakdownCard
          ready={ready}
          rows={productRows}
          showAllProducts={showAllProducts}
          totalProductCount={productPulseCount}
          timeWindow={overviewTimeFilter}
          timeFilterLabel={overviewTimeFilterLabel}
          onViewAllProducts={
            hasMoreProducts ? () => setShowAllProducts((v) => !v) : undefined
          }
        />
      </div>

      <div className={`grid grid-cols-1 gap-6 ${isCx ? 'lg:grid-cols-2' : 'xl:grid-cols-3'}`}>
        {!isCx && (
          <TopFeedbackTopicsCard
            ready={ready}
            topics={topics}
            showAllTopics={showAllTopics}
            totalTopicCount={topicCount}
            onViewAllTopics={hasMoreTopics ? () => setShowAllTopics((v) => !v) : undefined}
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
    </div>
  )
}
