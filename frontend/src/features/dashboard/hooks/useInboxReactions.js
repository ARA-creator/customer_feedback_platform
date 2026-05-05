import { useCallback, useMemo } from 'react'

export function useInboxReactions({ setReactionsById } = {}) {
  const setReaction = useCallback(
    (itemId, reaction) => {
      if (!itemId) return
      if (typeof setReactionsById !== 'function') return

      setReactionsById((prev) => {
        const current = prev[itemId] || { thumbsUp: false, thumbsDown: false, flagged: false }
        const next = { ...current }

        if (reaction === 'thumbsUp') {
          next.thumbsUp = !current.thumbsUp
          if (next.thumbsUp) next.thumbsDown = false
        } else if (reaction === 'thumbsDown') {
          next.thumbsDown = !current.thumbsDown
          if (next.thumbsDown) next.thumbsUp = false
        } else if (reaction === 'flag') {
          next.flagged = !current.flagged
        } else {
          return prev
        }

        return {
          ...prev,
          [itemId]: next,
        }
      })
    },
    [setReactionsById],
  )

  return useMemo(
    () => ({
      setReaction,
    }),
    [setReaction],
  )
}

