import { useEffect } from 'react'
import { mergeFeedbackItems } from '../../../shared/utils/mergeFeedbackItems'

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
            const [recentData, priorityData] = await Promise.all([
              getRecentFeedback(100, recentQuery).catch(() => ({ feedback: [] })),
              getPriorityQueue(50).catch(() => ({ feedback: [] })),
            ])
            setRecentFeedback((prev) => mergeFeedbackItems(prev, recentData.feedback || [], { max: 100 }))
            setPriorityQueue((prev) => mergeFeedbackItems(prev, priorityData.feedback || [], { max: 50 }))

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
    pushToast,
    setUnreadPriorityIds,
    setUnreadRecentIds,
  ])
}
