import { useCallback, useMemo, useState } from 'react'

export function useInboxSelection({ setStatusById } = {}) {
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  const toggleSelected = useCallback((id) => {
    if (!id) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const batchUpdateStatus = useCallback(
    (items, newStatus) => {
      if (!items?.length) return
      if (typeof setStatusById !== 'function') return

      setStatusById((prev) => {
        const next = { ...prev }
        for (const it of items) {
          if (it?.id) next[it.id] = newStatus
        }
        return next
      })
      clearSelection()
    },
    [setStatusById, clearSelection],
  )

  const count = selectedIds.size

  return useMemo(
    () => ({
      selectedIds,
      selectedCount: count,
      toggleSelected,
      clearSelection,
      batchUpdateStatus,
      setSelectedIds, // escape hatch for future bulk select
    }),
    [selectedIds, count, toggleSelected, clearSelection, batchUpdateStatus],
  )
}

