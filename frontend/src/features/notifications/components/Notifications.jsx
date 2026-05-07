import { useEffect, useMemo, useState } from 'react'
import { FiAlertCircle, FiBell, FiCheck, FiChevronDown, FiRefreshCw } from 'react-icons/fi'
import {
  connectNotificationsStream,
  getNotifications,
  getUnreadCount,
  markRead,
  markUnread,
} from '../services/notifications.api'
import { EmptyState, LastUpdated, NotificationListSkeleton } from '../../../shared/components/ui'

function fmtRelative(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const sec = Math.round((Date.now() - t) / 1000)
  if (sec < 45) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 14) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function Notifications({ isAdminUI = false, onNavigate }) {
  const [items, setItems] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastLoadedAt, setLastLoadedAt] = useState(null)
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  // Preferences/settings panel removed; keep realtime streaming enabled.
  const realtimeEnabled = true

  const load = async ({ reset } = {}) => {
    setLoading(true)
    setError(null)
    try {
      const [list, c] = await Promise.all([
        getNotifications({ cursor: reset ? undefined : nextCursor, limit: reset ? 30 : 20 }),
        getUnreadCount(),
      ])
      if (reset) {
        setItems(Array.isArray(list?.items) ? list.items : [])
      } else {
        setItems((prev) => [...prev, ...(Array.isArray(list?.items) ? list.items : [])])
      }
      setNextCursor(list?.next_cursor || null)
      setUnread(Number(c?.unread ?? 0) || 0)
      setLastLoadedAt(new Date())
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load notifications')
      setLastLoadedAt(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!realtimeEnabled) return
    const cleanup = connectNotificationsStream((evt) => {
      if (evt?.type === 'notification.created' && evt.notification) {
        setItems((prev) => [evt.notification, ...prev])
        if (Number.isFinite(Number(evt.unread))) setUnread(Number(evt.unread))
      }
    })
    return cleanup
  }, [realtimeEnabled])

  const unreadItems = useMemo(() => items.filter((x) => !x?.read_at), [items])
  const selectedCount = useMemo(() => selectedIds.size, [selectedIds])
  const unreadIds = useMemo(() => unreadItems.map((n) => n.id).filter(Boolean), [unreadItems])
  const allUnreadSelected = useMemo(() => {
    if (!unreadIds.length) return false
    for (const id of unreadIds) {
      if (!selectedIds.has(id)) return false
    }
    return true
  }, [selectedIds, unreadIds])

  const clearSelection = () => setSelectedIds(new Set())
  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleSelectAllUnread = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (!unreadIds.length) return next
      const shouldSelectAll = !allUnreadSelected
      if (shouldSelectAll) unreadIds.forEach((id) => next.add(id))
      else unreadIds.forEach((id) => next.delete(id))
      return next
    })
  }

  const markSelectedRead = async () => {
    const ids = Array.from(selectedIds).filter(Boolean)
    const unreadSet = new Set(unreadItems.map((n) => n.id).filter(Boolean))
    const idsToMark = ids.filter((id) => unreadSet.has(id))
    if (!idsToMark.length) {
      clearSelection()
      return
    }
    try {
      const res = await markRead({ ids: idsToMark })
      setUnread(Number(res?.unread ?? unread) || 0)
      const nowIso = new Date().toISOString()
      setItems((prev) => prev.map((x) => (idsToMark.includes(x.id) ? { ...x, read_at: x.read_at || nowIso } : x)))
      clearSelection()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to mark selected read')
    }
  }

  const markSelectedUnread = async () => {
    const ids = Array.from(selectedIds).filter(Boolean)
    const readSet = new Set(items.filter((n) => !!n?.read_at).map((n) => n.id).filter(Boolean))
    const idsToMark = ids.filter((id) => readSet.has(id))
    if (!idsToMark.length) {
      clearSelection()
      return
    }
    try {
      const res = await markUnread({ ids: idsToMark })
      setUnread(Number(res?.unread ?? unread) || 0)
      setItems((prev) => prev.map((x) => (idsToMark.includes(x.id) ? { ...x, read_at: null } : x)))
      clearSelection()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to mark selected unread')
    }
  }

  const ReadTicks = () => (
    <span className="inline-flex items-center text-[#009750]" title="Read" aria-label="Read">
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <polyline points="2.8 13 6.8 17 13.3 10.5" />
        <polyline points="10.2 13 14.2 17 21.2 9.5" />
      </svg>
    </span>
  )
  const canNavigate = typeof onNavigate === 'function'

  const openNotification = async (n) => {
    const href = String(n?.href || '').trim()
    const meta = n?.meta && typeof n.meta === 'object' ? n.meta : {}
    const feedbackId = Number(meta?.feedback_id)

    if (href === 'inbox' && Number.isFinite(feedbackId)) {
      try {
        sessionStorage.setItem('cfp_inbox_open_feedback_id', String(feedbackId))
      } catch {
        // ignore
      }
    }
    if (href === 'inbox' && meta?.inbox_preset && typeof meta.inbox_preset === 'object') {
      try {
        sessionStorage.setItem('cfp_inbox_anomaly_preset', JSON.stringify(meta.inbox_preset))
      } catch {
        // ignore
      }
    }
    if (canNavigate && href) onNavigate(href)

    // Mark read after opening (best-effort).
    if (!n?.read_at && n?.id) {
      try {
        const res = await markRead({ ids: [n.id] })
        setUnread(Number(res?.unread ?? unread) || 0)
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
      } catch {
        // ignore
      }
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 mx-auto max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#009750]/10 text-[#009750] dark:bg-emerald-500/10 dark:text-emerald-300">
            <FiBell className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
              Notifications
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Unread: <span className="font-semibold">{unread}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={() => load({ reset: true })}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-200 bg-white/70 px-3.5 py-2 text-xs font-semibold text-gray-800 shadow-sm backdrop-blur-md hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#009750]/30 dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-100 dark:hover:bg-gray-950/55"
          >
            <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={markSelectedRead}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-gray-200 bg-white/70 px-3.5 py-2 text-xs font-semibold text-gray-800 shadow-sm backdrop-blur-md hover:bg-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#009750]/30 dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-100 dark:hover:bg-gray-950/55"
            title="Mark selected as read"
          >
            Mark selected read
          </button>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={markSelectedUnread}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-gray-200 bg-white/70 px-3.5 py-2 text-xs font-semibold text-gray-800 shadow-sm backdrop-blur-md hover:bg-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#009750]/30 dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-100 dark:hover:bg-gray-950/55"
            title="Mark selected as unread"
          >
            Mark selected unread
          </button>
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex min-h-[40px] items-center rounded-lg border border-transparent bg-transparent px-2 py-2 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              title="Clear selection"
            >
              Clear ({selectedCount})
            </button>
          )}
          </div>
          {!loading && lastLoadedAt ? <LastUpdated at={lastLoadedAt} /> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-3">
          {loading && <NotificationListSkeleton rows={5} />}
          {!loading && error && (
            <div
              className="card p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-rose-200 bg-rose-50/60 backdrop-blur-md dark:border-rose-900/40 dark:bg-rose-950/20"
              role="alert"
            >
              <div className="flex gap-3 text-sm text-rose-900 dark:text-rose-100">
                <FiAlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="font-semibold">Couldn’t load notifications</p>
                  <p className="mt-1 text-rose-800/90 dark:text-rose-200/90">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => load({ reset: true })}
                className="inline-flex shrink-0 min-h-[44px] items-center justify-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
              >
                <FiRefreshCw className="h-4 w-4" aria-hidden />
                Retry
              </button>
            </div>
          )}
          {!loading && !error && items.length === 0 && (
            <EmptyState
              icon={FiBell}
              title="You’re all caught up"
              description="We’ll list new feedback, assignments, and system alerts here as they happen. Use Refresh if you expect something new."
            />
          )}
          {!loading && !error && items.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                className="h-4 w-4 rounded-full border-gray-300 text-[#009750] focus:ring-[#009750]/30"
                checked={allUnreadSelected}
                onChange={toggleSelectAllUnread}
                aria-label="Select all unread notifications"
              />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Select all</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({unreadItems.length} unread)
              </span>
            </div>
          )}
          {!loading &&
            !error &&
            items.map((n) => {
              const isUnread = !n.read_at
              const href = String(n?.href || '').trim()
              const meta = n?.meta && typeof n.meta === 'object' ? n.meta : {}
              const feedbackId = Number(meta?.feedback_id)
              const openLabel =
                href === 'inbox' && Number.isFinite(feedbackId)
                  ? 'Open feedback'
                  : href
                    ? 'Open'
                    : null
              return (
                <div
                  key={n.id}
                  className="card p-0 overflow-hidden bg-white/60 backdrop-blur-md dark:bg-gray-950/25"
                >
                  <div
                    role={canNavigate && href ? 'button' : undefined}
                    tabIndex={canNavigate && href ? 0 : -1}
                    onClick={() => {
                      if (canNavigate && href) openNotification(n)
                    }}
                    onKeyDown={(e) => {
                      if (!(canNavigate && href)) return
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openNotification(n)
                      }
                    }}
                    className={`w-full text-left p-4 sm:p-5 border transition-all ${
                      isUnread
                        ? 'border-emerald-200/80 dark:border-emerald-400/20'
                        : 'border-gray-200/70 dark:border-white/10'
                    } ${
                      !canNavigate || !href
                        ? 'cursor-default'
                        : 'hover:bg-white/70 dark:hover:bg-gray-950/45'
                    } focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750]/30`}
                    aria-label={href ? 'Open notification' : 'Notification'}
                  >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(n.id)}
                        onChange={() => {
                          try {
                            window.event?.stopPropagation?.()
                          } catch {
                            // ignore
                          }
                          toggleSelected(n.id)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Select notification"
                        className="h-4 w-4 rounded-full border-gray-300 text-[#009750] focus:ring-[#009750]/30"
                      />
                    </div>
                    <div
                      className={`mt-0.5 h-2.5 w-2.5 rounded-full ${
                        isUnread ? 'bg-[#009750]' : 'bg-gray-300 dark:bg-gray-700'
                      }`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{n.title || 'Notification'}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          {!isUnread && <ReadTicks />}
                          <span>{fmtRelative(n.created_at)}</span>
                        </div>
                      </div>
                      {n.body && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{n.body}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {isUnread && (
                          <button
                            type="button"
                            onClick={async () => {
                              // prevent opening parent button
                              try {
                                window.event?.stopPropagation?.()
                              } catch {
                                // ignore
                              }
                              try {
                                const res = await markRead({ ids: [n.id] })
                                setUnread(Number(res?.unread ?? unread) || 0)
                                setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
                              } catch (e) {
                                setError(e?.response?.data?.error || e?.message || 'Failed to mark read')
                              }
                            }}
                            className="inline-flex min-h-[36px] items-center rounded-xl border border-gray-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm backdrop-blur-md hover:bg-white dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-100 dark:hover:bg-gray-950/55"
                          >
                            Mark read
                          </button>
                        )}
                        {!isUnread && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              try {
                                const res = await markUnread({ ids: [n.id] })
                                setUnread(Number(res?.unread ?? unread) || 0)
                                setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: null } : x)))
                              } catch (err) {
                                setError(err?.response?.data?.error || err?.message || 'Failed to mark unread')
                              }
                            }}
                            className="inline-flex min-h-[36px] items-center rounded-xl border border-gray-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm backdrop-blur-md hover:bg-white dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-100 dark:hover:bg-gray-950/55"
                          >
                            Mark unread
                          </button>
                        )}
                        {openLabel && canNavigate && href && (
                          <span className="inline-flex min-h-[36px] items-center rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-950 shadow-sm dark:border-emerald-400/15 dark:bg-emerald-400/10 dark:text-emerald-100">
                            {openLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              )
            })}
          {!loading && !error && nextCursor && (
            <button
              type="button"
              onClick={() => load({ reset: false })}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-200 bg-white/70 px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm backdrop-blur-md hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#009750]/30 dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-100 dark:hover:bg-gray-950/55"
            >
              Load more
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

