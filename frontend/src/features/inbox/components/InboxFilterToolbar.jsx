import { useId, useRef, useState } from 'react'
import { FiArchive, FiCalendar, FiChevronDown, FiGlobe, FiInbox, FiRefreshCw, FiSearch } from 'react-icons/fi'
import { useCloseOnOutsidePointer } from '../../../shared/hooks/useCloseOnOutsidePointer'

const TOOLBAR_CONTROL =
  'inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#009750]/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'

function CountBadge({ count, active }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
        active ? 'bg-white/20 text-white' : 'bg-[#009750] text-white'
      }`}
    >
      {Number.isFinite(count) ? count : 0}
    </span>
  )
}

function FilterChevronSelect({ value, onChange, options, ariaLabel, icon: Icon, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      {Icon ? (
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden />
      ) : null}
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label={ariaLabel}
        className={`${TOOLBAR_CONTROL} appearance-none pr-8 ${Icon ? 'pl-9' : 'pl-3'}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <FiChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        aria-hidden
      />
    </div>
  )
}

function ChannelFilterMenu({
  source,
  onSourceChange,
  sourceTabs,
  counts,
  selectedSourceLabel,
  selectedSourceCount,
  formatSourceLabel,
  SourceIcon,
}) {
  const menuId = useId()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  useCloseOnOutsidePointer(rootRef, open, setOpen)

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Filter by channel"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={`${TOOLBAR_CONTROL} cursor-pointer select-none`}
      >
        <FiGlobe className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
        <span className="max-w-[7rem] truncate sm:max-w-[9rem]">{selectedSourceLabel}</span>
        <CountBadge count={selectedSourceCount} />
        <FiChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          id={menuId}
          className="absolute left-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-950"
          role="menu"
          aria-label="Channel options"
        >
          <div className="max-h-72 overflow-y-auto p-1">
            {sourceTabs.map((k) => {
              const label = formatSourceLabel(k)
              const n = Number(counts?.[k] ?? counts?.[k.toLowerCase()] ?? 0)
              const count = Number.isFinite(n) ? n : 0
              const active = source === k
              return (
                <button
                  key={k}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onSourceChange?.(k)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${
                    active
                      ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900'
                  }`}
                >
                  {k !== 'all' ? <SourceIcon source={k} /> : <FiGlobe className="h-3.5 w-3.5 text-gray-500" />}
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <CountBadge count={count} active={false} />
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function InboxFilterToolbar({
  searchDraft,
  onSearchDraftChange,
  onSearchSubmit,
  searchInputRef,
  sentiment,
  onSentimentChange,
  sentimentOptions,
  source,
  onSourceChange,
  sourceTabs,
  counts,
  selectedSourceLabel,
  selectedSourceCount,
  formatSourceLabel,
  SourceIcon,
  insuranceTagFilter,
  onInsuranceTagChange,
  themeOptions,
  dateRange,
  onDateRangeChange,
  dateRangeOptions,
  folder,
  onFolderChange,
  inboxCount,
  archiveCount,
  onRefresh,
  loading = false,
}) {
  return (
    <div className="rounded-2xl border border-gray-200/90 bg-white px-3 py-2.5 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:px-4">
      <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
        <div className="flex min-h-[40px] min-w-[12rem] flex-1 basis-[14rem] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <FiSearch className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
          <input
            ref={searchInputRef}
            value={searchDraft}
            onChange={(e) => onSearchDraftChange?.(e.target.value)}
            placeholder="Search feedback..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onSearchSubmit?.()
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100"
            aria-label="Search feedback"
          />
          <kbd className="hidden shrink-0 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 sm:inline dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
            ⌘ K
          </kbd>
        </div>

        <FilterChevronSelect
          value={sentiment}
          onChange={onSentimentChange}
          ariaLabel="Filter by sentiment"
          options={sentimentOptions}
        />

        <ChannelFilterMenu
          source={source}
          onSourceChange={onSourceChange}
          sourceTabs={sourceTabs}
          counts={counts}
          selectedSourceLabel={selectedSourceLabel}
          selectedSourceCount={selectedSourceCount}
          formatSourceLabel={formatSourceLabel}
          SourceIcon={SourceIcon}
        />

        <FilterChevronSelect
          value={insuranceTagFilter}
          onChange={onInsuranceTagChange}
          ariaLabel="Filter by theme"
          options={themeOptions}
        />

        <FilterChevronSelect
          value={dateRange}
          onChange={onDateRangeChange}
          ariaLabel="Filter by date"
          icon={FiCalendar}
          options={dateRangeOptions}
        />

        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2 max-sm:w-full">
          <div
            className="inline-flex shrink-0 rounded-full border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900"
            role="tablist"
            aria-label="Inbox folders"
          >
            {[
              { key: 'inbox', label: 'Inbox', Icon: FiInbox, count: inboxCount },
              { key: 'archive', label: 'Archive', Icon: FiArchive, count: archiveCount },
            ].map(({ key, label, Icon, count }) => {
              const active = folder === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onFolderChange?.(key)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#009750]/40 ${
                    active
                      ? 'bg-[#009750] text-white'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800'
                  }`}
                  role="tab"
                  aria-selected={active}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{label}</span>
                  <CountBadge count={count} active={active} />
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh inbox"
            title="Refresh"
            className="inline-flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#009750]/30 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <FiRefreshCw className={`h-4 w-4 shrink-0 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
