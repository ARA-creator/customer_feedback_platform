import EmptyState from './EmptyState'

export default function DashboardInboxSection({
  inboxHasActiveFilters,
  inboxActiveFilterLabels,
  handleQuickFilter,
  searchQuery,
  setSearchQuery,
  selectedSavedView,
  setSelectedSavedView,
  savedViews,
  sentimentFilter,
  setSentimentFilter,
  categoryFilter,
  setCategoryFilter,
  categoryOptions,
  dateRange,
  setDateRange,
  customDateFrom,
  setCustomDateFrom,
  customDateTo,
  setCustomDateTo,
  sourceTabs,
  sourceFilter,
  setSourceFilter,
  sourceTabCounts,
  SourceLogo,
  unreadPriorityIds,
  selectedIds,
  visiblePriorityQueue,
  reactionsById,
  getStatus,
  getStatusClasses,
  openFeedbackModal,
  toggleSelected,
  setReaction,
  formatRelativeTime,
  formatSentimentWord,
  SourcePill,
  inboxLoading,
  inboxDelayPassed,
  batchUpdateStatus,
  clearSelection,
  FiCheckCircle,
  FiArchive,
  FiInbox,
  FiUploadCloud,
  FiRefreshCw,
  FiThumbsUp,
  FiThumbsDown,
  FiFlag,
  isAdminUser,
  reloadDashboardRef,
  unreadRecentIds,
  visibleRecentFeedback,
}) {
  return (
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
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Search feedback</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by message, customer ID, or category"
                    className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/60 focus:border-[#009750]"
                  />
                </div>
                <div className="w-[200px] shrink-0">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Saved views</label>
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
                <label className="text-xs font-medium text-gray-600 mb-1 block">Sentiment</label>
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
                <label className="text-xs font-medium text-gray-600 mb-1 block">Category</label>
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
                <label className="text-xs font-medium text-gray-600 mb-1 block">Date range</label>
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
                <label className="text-xs font-medium text-gray-600 mb-1 block">From</label>
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/60 focus:border-[#009750]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">To</label>
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
                  const count = t.id === 'all' ? sourceTabCounts.all || 0 : sourceTabCounts[t.id] || 0
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
                          active ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-700'
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
              <div key={idx} className="bg-gray-50 rounded-lg border border-gray-200 p-5 animate-pulse">
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
                            status,
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
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
              console.log('Import feedback clicked')
            }}
            secondaryLabel={isAdminUser ? 'Connect a channel' : undefined}
            secondaryOnClick={
              isAdminUser
                ? () => {
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
              <div key={idx} className="bg-gray-50 rounded-lg border border-gray-200 p-5 animate-pulse">
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
                        className={`px-3 py-1 rounded-md text-xs font-semibold ${getStatusClasses(status)}`}
                      >
                        {status}
                      </span>
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
                  <p className="text-gray-700 text-sm leading-relaxed line-clamp-3">{item.message || 'No message'}</p>
                  <div className="flex items-center justify-between gap-2 mt-3">
                    {item.source && (
                      <p className="text-xs text-gray-500">
                        <span className="font-medium text-gray-600">Source:</span> {item.source}
                      </p>
                    )}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
  )
}
