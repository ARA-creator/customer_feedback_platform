import { useEffect } from 'react'
import { mergeFeedbackItems, maxFeedbackId } from '../../../shared/utils/mergeFeedbackItems'

export function useDashboardSse({
  getBackendOrigin,
  mode,
  dashboardAutoRefreshRef,
  analyticsSseDebounceRef,
  refreshDashboardSilentRef,
  getRecentFeedback,
  getRecentFeedbackParamsRef,
  getPriorityQueue,
  setRecentFeedback,
  setPriorityQueue,
  recentFeedbackRef,
  priorityQueueRef,
  pushToast,
  setUnreadPriorityIds,
  setUnreadRecentIds,
}) {
  useEffect(() => {
    const source = new EventSource(`${getBackendOrigin()}/api/events`, {
      withCredentials: false,
    })

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type !== 'feedback_created') return

        if ((mode === 'overview' || mode === 'insights') && dashboardAutoRefreshRef.current) {
          if (analyticsSseDebounceRef.current) clearTimeout(analyticsSseDebounceRef.current)
          analyticsSseDebounceRef.current = setTimeout(() => {
            refreshDashboardSilentRef.current?.()
          }, 500)
        }

        ;(async () => {
          try {
            const recentQuery = getRecentFeedbackParamsRef?.current || {}
            const afterRecent = maxFeedbackId(recentFeedbackRef?.current)
            const afterPriority = maxFeedbackId(priorityQueueRef?.current)
            const [recentData, priorityData] = await Promise.all([
              getRecentFeedback(100, {
                ...recentQuery,
                ...(afterRecent ? { after_id: afterRecent } : {}),
              }).catch(() => ({ feedback: [] })),
              getPriorityQueue(50, afterPriority ? { after_id: afterPriority } : {}).catch(() => ({
                feedback: [],
              })),
            ])
            const nextRecent = recentData.feedback || []
            const nextPriority = priorityData.feedback || []
            if (nextRecent.length) {
              setRecentFeedback((prev) => mergeFeedbackItems(prev, nextRecent, { max: 100 }))
            }
            if (nextPriority.length) {
              setPriorityQueue((prev) => mergeFeedbackItems(prev, nextPriority, { max: 50 }))
            }

            if (data.priority >= 100 || data.sentiment_label === 'negative') {
              pushToast(
                'New high-priority feedback',
                `${data.source || 'Unknown channel'} · ${data.category || 'Uncategorized'}`,
                'warning',
              )

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
      } catch (err) {
        console.error('Error handling SSE message', err)
      }
    }

    return () => {
      if (analyticsSseDebounceRef.current) clearTimeout(analyticsSseDebounceRef.current)
      source.close()
    }
  }, [
    getBackendOrigin,
    mode,
    dashboardAutoRefreshRef,
    analyticsSseDebounceRef,
    refreshDashboardSilentRef,
    getRecentFeedback,
    getRecentFeedbackParamsRef,
    getPriorityQueue,
    setRecentFeedback,
    setPriorityQueue,
    recentFeedbackRef,
    priorityQueueRef,
    pushToast,
    setUnreadPriorityIds,
    setUnreadRecentIds,
  ])
}
