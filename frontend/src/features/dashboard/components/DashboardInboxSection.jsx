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
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 mb-4 px-4 sm:px-6 lg:px-8 py-3 bg-white/35 dark:bg-gray-950/35 backdrop-blur-xl border-b border-emerald-100/60 dark:border-white/10 shadow-[0_1px_0_rgba(16,185,129,0.05),0_10px_30px_rgba(2,6,23,0.04)] space-y-3">
        {inboxHasActiveFilters && (
          <div
            className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200/50 bg-white/55 px-3 py-2.5 shadow-sm backdrop-blur-md dark:border-emerald-400/15 dark:bg-gray-950/35"
            role="status"
            aria-live="polite"
          >
            <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 shrink-0">Viewing:</span>
            {inboxActiveFilterLabels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full border border-emerald-200/60 bg-emerald-50/70 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-900 dark:border-emerald-400/15 dark:bg-emerald-400/10 dark:text-emerald-100"
              >
                {label}
              </span>
            ))}
            <button
              type="button"
              onClick={() => handleQuickFilter('clear')}
              className="ml-auto inline-flex min-h-[44px] items-center rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#009750]/30 dark:border-white/10 dark:bg-gray-950/40 dark:text-gray-100 dark:hover:bg-gray-950/55"
            >
              Clear all filters
            </button>
          </div>
        )}

        <div className="card p-4 sm:p-6 shadow-md bg-white/60 dark:bg-gray-950/35 backdrop-blur-md">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="w-full lg:max-w-md">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <label className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 block">
                    Search feedback
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by message, customer ID, or category"
                    className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#009750]/35 focus:border-emerald-300 dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-100 dark:placeholder:text-gray-500"
                  />
                </div>
                <div className="w-full sm:w-56 shrink-0">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
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
                    className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-white/80 px-2.5 py-2 text-xs font-semibold text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/35 focus:border-emerald-300 dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-100"
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
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                  Sentiment
                </label>
                <select
                  value={sentimentFilter}
                  onChange={(e) => setSentimentFilter(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-white/80 px-2.5 py-2 text-xs font-semibold text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/35 focus:border-emerald-300 dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-100"
                >
                  <option value="all">All sentiments</option>
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="negative">Negative</option>
                </select>
              </div>

              {/* Source tabs live below as primary control. */}

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                  Category
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-white/80 px-2.5 py-2 text-xs font-semibold text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/35 focus:border-emerald-300 dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-100"
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
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                  Date range
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-white/80 px-2.5 py-2 text-xs font-semibold text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/35 focus:border-emerald-300 dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-100"
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
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                  From
                </label>
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/35 focus:border-emerald-300 dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                  To
                </label>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/35 focus:border-emerald-300 dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-100"
                />
              </div>
            </div>
          )}

          <div className="mt-4">
            <div className="w-full overflow-x-auto">
              <div className="inline-flex items-center gap-2 pb-1">
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
                      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all shadow-sm backdrop-blur-md ${
                        active
                          ? 'border-emerald-300/70 bg-emerald-50/80 text-emerald-950 shadow-[0_8px_24px_rgba(16,185,129,0.12)] dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-100'
                          : 'border-gray-200 bg-white/70 text-gray-800 hover:bg-white dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-100 dark:hover:bg-gray-950/55'
                      }`}
                    >
                      {t.id !== 'all' && <SourceLogo source={t.id} />}
                      <span className="whitespace-nowrap">{t.label}</span>
                      <span
                        className={`ml-0.5 inline-flex min-w-[28px] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                          active
                            ? 'bg-emerald-700 text-white dark:bg-emerald-300/20 dark:text-emerald-100'
                            : 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200'
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            Priority Queue
          </h2>
          <div className="flex items-center gap-2">
            {unreadPriorityIds.size > 0 && (
              <span className="inline-flex items-center rounded-full border border-red-200/70 bg-red-50/80 px-2.5 py-0.5 text-[11px] font-semibold text-red-700 dark:border-red-400/15 dark:bg-red-400/10 dark:text-red-200">
                New {unreadPriorityIds.size}
              </span>
            )}
            {selectedIds.size > 0 && (
              <span className="inline-flex items-center rounded-full bg-gray-900/90 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm dark:bg-white/10">
                Selected {selectedIds.size}
              </span>
            )}
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex min-h-[40px] items-center rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
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
              className="inline-flex min-h-[40px] items-center rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-black focus:outline-none focus:ring-2 focus:ring-[#009750]/25 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15"
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
              className="inline-flex min-h-[40px] items-center rounded-xl border border-gray-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#009750]/25 dark:border-white/10 dark:bg-gray-950/30 dark:text-gray-100 dark:hover:bg-gray-950/50"
              onClick={clearSelection}
            >
              Clear selection
            </button>
          </div>
        )}

        {inboxLoading || !inboxDelayPassed ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="rounded-2xl border border-gray-200/80 bg-white/60 p-5 animate-pulse backdrop-blur-md dark:border-white/10 dark:bg-gray-950/25">
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
                  className="group rounded-2xl border border-gray-200/80 bg-white/60 p-5 shadow-sm backdrop-blur-md transition-all duration-200 cursor-pointer hover:-translate-y-[1px] hover:border-emerald-200/80 hover:shadow-[0_16px_40px_rgba(2,6,23,0.08),0_10px_30px_rgba(16,185,129,0.10),0_0_0_1px_rgba(16,185,129,0.14)] dark:border-white/10 dark:bg-gray-950/25 dark:hover:border-emerald-400/20"
                  onClick={() => openFeedbackModal(item)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <label
                      className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300"
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
                              ? 'border border-red-200/70 bg-red-50/80 text-red-700 dark:border-red-400/15 dark:bg-red-400/10 dark:text-red-200'
                              : item.sentiment_label === 'positive'
                                ? 'border border-emerald-200/60 bg-emerald-50/80 text-emerald-900 dark:border-emerald-400/15 dark:bg-emerald-400/10 dark:text-emerald-100'
                                : 'border border-gray-200/70 bg-white/70 text-gray-700 dark:border-white/10 dark:bg-gray-950/30 dark:text-gray-200'
                          }`}
                        >
                          {formatSentimentWord(item.sentiment_label)}
                        </span>
                        {item.category && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] border border-indigo-200/70 bg-indigo-50/70 text-indigo-800 dark:border-indigo-400/15 dark:bg-indigo-400/10 dark:text-indigo-200">
                            {item.category}
                          </span>
                        )}
                        {item.priority && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-amber-200/80 bg-amber-50/75 text-amber-900 dark:border-amber-400/15 dark:bg-amber-400/10 dark:text-amber-200">
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
                          <span className="px-2.5 py-1 rounded-full text-[11px] border border-gray-200/70 bg-white/70 text-gray-700 dark:border-white/10 dark:bg-gray-950/30 dark:text-gray-200">
                            Rating {item.rating}/5
                          </span>
                        )}
                      </div>
                      <p className="mt-3 text-gray-950 dark:text-gray-100 text-sm font-semibold leading-snug line-clamp-2">
                        {item.message || item.message_preview || 'No message'}
                      </p>
                      <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400 line-clamp-1">
                        {item.customer_id ? `Customer: ${item.customer_id}` : ' '}
                      </p>
                    </div>
                    <span
                      className="text-xs text-gray-500 dark:text-gray-400 font-semibold text-right shrink-0 max-w-[9rem] sm:max-w-none tabular-nums"
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
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {item.created_at ? `Received ${formatRelativeTime(item.created_at)}` : ''}
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setReaction(item.id, 'thumbsUp')}
                        className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          r.thumbsUp
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-400/10 dark:border-emerald-400/25 dark:text-emerald-100'
                            : 'bg-white/70 border-gray-200 text-gray-600 hover:bg-white dark:bg-gray-950/30 dark:border-white/10 dark:text-gray-200 dark:hover:bg-gray-950/50'
                        }`}
                      >
                        <FiThumbsUp className="w-3 h-3 mr-1" />
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => setReaction(item.id, 'thumbsDown')}
                        className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          r.thumbsDown
                            ? 'bg-red-50 border-red-300 text-red-800 dark:bg-red-400/10 dark:border-red-400/25 dark:text-red-200'
                            : 'bg-white/70 border-gray-200 text-gray-600 hover:bg-white dark:bg-gray-950/30 dark:border-white/10 dark:text-gray-200 dark:hover:bg-gray-950/50'
                        }`}
                      >
                        <FiThumbsDown className="w-3 h-3 mr-1" />
                        Down
                      </button>
                      <button
                        type="button"
                        onClick={() => setReaction(item.id, 'flag')}
                        className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          r.flagged
                            ? 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-400/10 dark:border-amber-400/25 dark:text-amber-200'
                            : 'bg-white/70 border-gray-200 text-gray-600 hover:bg-white dark:bg-gray-950/30 dark:border-white/10 dark:text-gray-200 dark:hover:bg-gray-950/50'
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            Recent Feedback
          </h2>
          {unreadRecentIds.size > 0 && (
            <span className="inline-flex items-center rounded-full border border-emerald-200/60 bg-emerald-50/70 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900 dark:border-emerald-400/15 dark:bg-emerald-400/10 dark:text-emerald-100">
              New {unreadRecentIds.size}
            </span>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex min-h-[40px] items-center rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
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
              className="inline-flex min-h-[40px] items-center rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-black focus:outline-none focus:ring-2 focus:ring-[#009750]/25 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15"
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
              className="inline-flex min-h-[40px] items-center rounded-xl border border-gray-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#009750]/25 dark:border-white/10 dark:bg-gray-950/30 dark:text-gray-100 dark:hover:bg-gray-950/50"
              onClick={clearSelection}
            >
              Clear selection
            </button>
          </div>
        )}

        {inboxLoading || !inboxDelayPassed ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="rounded-2xl border border-gray-200/80 bg-white/60 p-5 animate-pulse backdrop-blur-md dark:border-white/10 dark:bg-gray-950/25">
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
                  className="group rounded-2xl border border-gray-200/80 bg-white/60 p-5 shadow-sm backdrop-blur-md transition-all duration-200 cursor-pointer hover:-translate-y-[1px] hover:border-emerald-200/80 hover:shadow-[0_16px_40px_rgba(2,6,23,0.08),0_10px_30px_rgba(16,185,129,0.10),0_0_0_1px_rgba(16,185,129,0.14)] dark:border-white/10 dark:bg-gray-950/25 dark:hover:border-emerald-400/20"
                  onClick={() => openFeedbackModal(item)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <label
                      className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300"
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
                            ? 'border border-red-200/70 bg-red-50/80 text-red-700 dark:border-red-400/15 dark:bg-red-400/10 dark:text-red-200'
                            : item.sentiment_label === 'positive'
                              ? 'border border-emerald-200/60 bg-emerald-50/80 text-emerald-900 dark:border-emerald-400/15 dark:bg-emerald-400/10 dark:text-emerald-100'
                              : 'border border-gray-200/70 bg-white/70 text-gray-700 dark:border-white/10 dark:bg-gray-950/30 dark:text-gray-200'
                        }`}
                      >
                        {formatSentimentWord(item.sentiment_label)}
                      </span>
                      {item.category && (
                        <span className="px-3 py-1 rounded-md text-xs border border-blue-200/70 bg-blue-50/70 text-blue-800 dark:border-blue-400/15 dark:bg-blue-400/10 dark:text-blue-200">
                          {item.category}
                        </span>
                      )}
                      {item.rating && (
                        <span className="px-3 py-1 rounded-md text-xs border border-purple-200/70 bg-purple-50/70 text-purple-800 dark:border-purple-400/15 dark:bg-purple-400/10 dark:text-purple-200">
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
                      className="text-xs text-gray-500 dark:text-gray-400 font-semibold text-right shrink-0 max-w-[9rem] sm:max-w-none tabular-nums"
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
                  <p className="text-gray-800 dark:text-gray-100 text-sm leading-relaxed font-medium line-clamp-3">
                    {item.message || 'No message'}
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-3">
                    {item.source && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Source:</span> {item.source}
                      </p>
                    )}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setReaction(item.id, 'thumbsUp')}
                        className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          r.thumbsUp
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-400/10 dark:border-emerald-400/25 dark:text-emerald-100'
                            : 'bg-white/70 border-gray-200 text-gray-600 hover:bg-white dark:bg-gray-950/30 dark:border-white/10 dark:text-gray-200 dark:hover:bg-gray-950/50'
                        }`}
                      >
                        <FiThumbsUp className="w-3 h-3 mr-1" />
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => setReaction(item.id, 'thumbsDown')}
                        className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          r.thumbsDown
                            ? 'bg-red-50 border-red-300 text-red-800 dark:bg-red-400/10 dark:border-red-400/25 dark:text-red-200'
                            : 'bg-white/70 border-gray-200 text-gray-600 hover:bg-white dark:bg-gray-950/30 dark:border-white/10 dark:text-gray-200 dark:hover:bg-gray-950/50'
                        }`}
                      >
                        <FiThumbsDown className="w-3 h-3 mr-1" />
                        Down
                      </button>
                      <button
                        type="button"
                        onClick={() => setReaction(item.id, 'flag')}
                        className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          r.flagged
                            ? 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-400/10 dark:border-amber-400/25 dark:text-amber-200'
                            : 'bg-white/70 border-gray-200 text-gray-600 hover:bg-white dark:bg-gray-950/30 dark:border-white/10 dark:text-gray-200 dark:hover:bg-gray-950/50'
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
