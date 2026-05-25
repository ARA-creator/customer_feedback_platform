import { useEffect, useMemo, useState } from 'react'
import AiInsightBar from './overview/AiInsightBar'
import SentimentBreakdownCard from './overview/SentimentBreakdownCard'
import RecentFeedbackCard from './overview/RecentFeedbackCard'
import TopFeedbackTopicsCard from './overview/TopFeedbackTopicsCard'
import SentimentTrendCard from './overview/SentimentTrendCard'
import VolumeByChannelCard from './overview/VolumeByChannelCard'
import { buildChannelDonutData, buildTopicsTableRows } from './overview/chartUi'

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
  recentFeedback = [],
  onNavigateToInsights,
  onNavigateToInbox,
  onOpenFeedback,
  analyzerLoading,
  analyzerError,
  analyzerResult,
  overviewTimeFilterLabel,
  onAnalyzerRefresh,
  onAnalyzerDetails,
  analyzerRefreshDisabled,
}) {
  const trendTitle = overviewTrendLabels?.title || 'Sentiment Trend'
  const allChannelRows = buildChannelDonutData(sourcePerformance)
  const [channelFilter, setChannelFilter] = useState('all')

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
  const topics = buildTopicsTableRows(insuranceTagsBreakdown, { limit: 5 })
  const ready = !analyticsLoading && analyticsDelayPassed

  return (
    <div className="space-y-6">
      {/* Row 1: Sentiment trend + Volume by channel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SentimentTrendCard
          ready={ready}
          trendTitle={trendTitle}
          trendData={trendData}
          trendAllZero={trendAllZero}
          overviewTrendLabels={overviewTrendLabels}
          onNavigateToInsights={onNavigateToInsights}
        />

        <VolumeByChannelCard
          ready={ready}
          channelRows={channelRows}
          channelTotal={channelTotal}
          channelFilter={channelFilter}
          onChannelFilterChange={setChannelFilter}
          channelFilterOptions={channelFilterOptions}
        />
      </div>

      {/* Row 2: Topics + Recent + Sentiment breakdown */}
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
            recentFeedback={recentFeedback}
            onViewAll={onNavigateToInbox ? () => onNavigateToInbox() : onNavigateToInsights}
            onViewAllFeedback={onNavigateToInbox ? () => onNavigateToInbox() : onNavigateToInsights}
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
