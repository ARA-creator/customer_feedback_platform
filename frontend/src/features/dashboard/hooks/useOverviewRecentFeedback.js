import { useEffect, useState } from 'react'
import { buildOverviewRecentFeedbackParams } from '../services/dashboard.api'

/**
 * Loads overview "Recent Feedback" when sentiment/time filters change.
 * Clears stale rows immediately so the card does not show the previous filter's items.
 */
export function useOverviewRecentFeedback({
  enabled,
  sentiment = 'all',
  timeWindow = 'all',
  getRecentFeedback,
  setRecentFeedback,
  paramsRef,
}) {
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) return undefined

    let cancelled = false
    const params = buildOverviewRecentFeedbackParams({ sentiment, timeWindow })
    if (paramsRef) paramsRef.current = params

    setLoading(true)
    setRecentFeedback([])

    ;(async () => {
      try {
        const data = await getRecentFeedback(25, params)
        if (cancelled) return
        setRecentFeedback(Array.isArray(data?.feedback) ? data.feedback : [])
      } catch (err) {
        console.error('Failed to load recent feedback', err)
        if (!cancelled) setRecentFeedback([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, sentiment, timeWindow, getRecentFeedback, setRecentFeedback, paramsRef])

  return { recentFeedbackLoading: loading }
}
