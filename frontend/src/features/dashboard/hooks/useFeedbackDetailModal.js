import { useCallback, useState } from 'react'

export function useFeedbackDetailModal({
  unreadPriorityIds,
  setUnreadPriorityIds,
  unreadRecentIds,
  setUnreadRecentIds,
}) {
  const [selectedFeedback, setSelectedFeedback] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const openFeedbackModal = useCallback(
    (item) => {
      setSelectedFeedback(item)
      setIsDetailOpen(true)

      if (unreadPriorityIds?.has?.(item?.id)) {
        setUnreadPriorityIds?.((prev) => {
          const next = new Set(prev)
          next.delete(item.id)
          return next
        })
      }
      if (unreadRecentIds?.has?.(item?.id)) {
        setUnreadRecentIds?.((prev) => {
          const next = new Set(prev)
          next.delete(item.id)
          return next
        })
      }
    },
    [setUnreadPriorityIds, setUnreadRecentIds, unreadPriorityIds, unreadRecentIds],
  )

  const closeFeedbackModal = useCallback(() => {
    setIsDetailOpen(false)
    setSelectedFeedback(null)
  }, [])

  return {
    selectedFeedback,
    setSelectedFeedback,
    isDetailOpen,
    setIsDetailOpen,
    openFeedbackModal,
    closeFeedbackModal,
  }
}

