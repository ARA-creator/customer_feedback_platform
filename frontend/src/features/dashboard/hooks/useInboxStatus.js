import { useCallback, useMemo } from 'react'

export function useInboxStatus({ statusById, setStatusById } = {}) {
  const getStatus = useCallback((item) => statusById?.[item?.id] || 'New', [statusById])

  const updateStatus = useCallback(
    (item, newStatus) => {
      if (!item?.id) return
      if (typeof setStatusById !== 'function') return

      setStatusById((prev) => ({
        ...prev,
        [item.id]: newStatus,
      }))
    },
    [setStatusById],
  )

  const getStatusClasses = useCallback((status) => {
    switch (status) {
      case 'Resolved':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-100'
      case 'In Progress':
        return 'bg-amber-50 text-amber-700 border border-amber-100'
      case 'Archived':
        return 'bg-gray-100 text-gray-600 border border-gray-200'
      default:
        return 'bg-blue-50 text-blue-700 border border-blue-100'
    }
  }, [])

  return useMemo(
    () => ({
      getStatus,
      updateStatus,
      getStatusClasses,
    }),
    [getStatus, updateStatus, getStatusClasses],
  )
}

