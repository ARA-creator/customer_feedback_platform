import { useMemo } from 'react'
import { filterFeedbackItems, normalizeSourceGroup } from '../utils/dashboardInboxFilters'

export function useSourceTabCounts({
  mode,
  serverSourceCounts,
  recentFeedback,
  priorityQueue,
  inboxFilters,
  getStatus,
}) {
  return useMemo(() => {
    if (mode === 'inbox' && serverSourceCounts?.raw && serverSourceCounts?.grouped) {
      return {
        all: Number(serverSourceCounts.total) || 0,
        ...serverSourceCounts.raw,
        ...serverSourceCounts.grouped,
      }
    }

    const counts = {}
    const uniqueById = new Map()

    for (const it of filterFeedbackItems(recentFeedback, inboxFilters, { ignoreSource: true })) {
      if (it?.id == null) continue
      uniqueById.set(it.id, it)
    }
    for (const it of filterFeedbackItems(priorityQueue, inboxFilters, { ignoreSource: true })) {
      if (it?.id == null) continue
      uniqueById.set(it.id, it)
    }

    const countBase = Array.from(uniqueById.values()).filter((it) => getStatus(it) !== 'Archived')
    counts.all = countBase.length

    for (const it of countBase) {
      const raw = String(it?.source || '').toLowerCase()
      if (!raw) continue
      counts[raw] = (counts[raw] || 0) + 1
      const group = normalizeSourceGroup(raw)
      if (group && group !== raw) counts[group] = (counts[group] || 0) + 1
    }

    return counts
  }, [mode, serverSourceCounts, recentFeedback, priorityQueue, inboxFilters, getStatus])
}

