import { useCallback, useEffect, useRef, useState } from 'react'
import { getInboxState, patchInboxState } from '../services/inbox.api'

const READ_IDS_KEY = 'cfp_inbox_read_feedback_ids'

export function normFeedbackId(id) {
  const n = Number(id)
  return Number.isFinite(n) && n > 0 ? n : null
}

function idsFromPayload(data) {
  const read = new Set(
    (Array.isArray(data?.read_feedback_ids) ? data.read_feedback_ids : [])
      .map(normFeedbackId)
      .filter(Boolean),
  )
  const pinned = new Set(
    (Array.isArray(data?.pinned_feedback_ids) ? data.pinned_feedback_ids : [])
      .map(normFeedbackId)
      .filter(Boolean),
  )
  return { read, pinned }
}

function readLocalStorageIds() {
  try {
    const raw = localStorage.getItem(READ_IDS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    if (!Array.isArray(arr)) return []
    return arr.map(normFeedbackId).filter(Boolean)
  } catch {
    return []
  }
}

export function useInboxUserState() {
  const [readIds, setReadIds] = useState(() => new Set())
  const [pinnedIds, setPinnedIds] = useState(() => new Set())
  const [ready, setReady] = useState(false)
  const migrateStarted = useRef(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await getInboxState()
        if (cancelled) return
        let { read, pinned } = idsFromPayload(data)
        const localRead = readLocalStorageIds()
        if (localRead.length && read.size === 0 && !migrateStarted.current) {
          migrateStarted.current = true
          try {
            const migrated = await patchInboxState({ mark_read: localRead })
            if (!cancelled) {
              const merged = idsFromPayload(migrated)
              read = merged.read
              pinned = new Set([...pinned, ...merged.pinned])
            }
          } catch {
            for (const id of localRead) read.add(id)
          }
          try {
            localStorage.removeItem(READ_IDS_KEY)
          } catch {
            // ignore
          }
        }
        if (!cancelled) {
          setReadIds(read)
          setPinnedIds(pinned)
        }
      } catch {
        const localRead = readLocalStorageIds()
        if (!cancelled && localRead.length) {
          setReadIds(new Set(localRead))
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const mergeFromFeedItems = useCallback((items) => {
    const list = Array.isArray(items) ? items : []
    if (!list.length) return
    setReadIds((prev) => {
      let next = prev
      for (const it of list) {
        if (typeof it?.inbox_read !== 'boolean') continue
        const id = normFeedbackId(it?.id)
        if (!id) continue
        if (it.inbox_read && !prev.has(id)) {
          if (next === prev) next = new Set(prev)
          next.add(id)
        } else if (!it.inbox_read && prev.has(id)) {
          if (next === prev) next = new Set(prev)
          next.delete(id)
        }
      }
      return next
    })
    setPinnedIds((prev) => {
      let next = prev
      for (const it of list) {
        if (typeof it?.inbox_pinned !== 'boolean') continue
        const id = normFeedbackId(it?.id)
        if (!id) continue
        if (it.inbox_pinned && !prev.has(id)) {
          if (next === prev) next = new Set(prev)
          next.add(id)
        } else if (!it.inbox_pinned && prev.has(id)) {
          if (next === prev) next = new Set(prev)
          next.delete(id)
        }
      }
      return next
    })
  }, [])

  const applyServerPayload = useCallback((data) => {
    if (!data) return
    if (!Array.isArray(data.read_feedback_ids) && !Array.isArray(data.pinned_feedback_ids)) return
    const { read, pinned } = idsFromPayload(data)
    setReadIds(read)
    setPinnedIds(pinned)
  }, [])

  const markIdsRead = useCallback(async (rawIds) => {
    const ids = [...new Set((Array.isArray(rawIds) ? rawIds : []).map(normFeedbackId).filter(Boolean))]
    if (!ids.length) return
    setReadIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      return next
    })
    try {
      const res = await patchInboxState({ mark_read: ids })
      applyServerPayload(res)
    } catch {
      setReadIds((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
    }
  }, [applyServerPayload])

  const markIdsUnread = useCallback(async (rawIds) => {
    const ids = [...new Set((Array.isArray(rawIds) ? rawIds : []).map(normFeedbackId).filter(Boolean))]
    if (!ids.length) return
    setReadIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
    try {
      const res = await patchInboxState({ mark_unread: ids })
      applyServerPayload(res)
    } catch {
      setReadIds((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.add(id)
        return next
      })
    }
  }, [applyServerPayload])

  const setPinned = useCallback(async (rawId, pinned) => {
    const id = normFeedbackId(rawId)
    if (!id) return
    setPinnedIds((prev) => {
      const next = new Set(prev)
      if (pinned) next.add(id)
      else next.delete(id)
      return next
    })
    try {
      const res = await patchInboxState({ pin: [{ feedback_id: id, pinned: !!pinned }] })
      applyServerPayload(res)
    } catch {
      setPinnedIds((prev) => {
        const next = new Set(prev)
        if (pinned) next.delete(id)
        else next.add(id)
        return next
      })
    }
  }, [applyServerPayload])

  const setPinnedMany = useCallback(
    async (rawIds, pinned) => {
      const ids = [...new Set((Array.isArray(rawIds) ? rawIds : []).map(normFeedbackId).filter(Boolean))]
      if (!ids.length) return
      setPinnedIds((prev) => {
        const next = new Set(prev)
        for (const id of ids) {
          if (pinned) next.add(id)
          else next.delete(id)
        }
        return next
      })
      try {
        const res = await patchInboxState({
          pin: ids.map((feedback_id) => ({ feedback_id, pinned: !!pinned })),
        })
        applyServerPayload(res)
      } catch {
        setPinnedIds((prev) => {
          const next = new Set(prev)
          for (const id of ids) {
            if (pinned) next.delete(id)
            else next.add(id)
          }
          return next
        })
      }
    },
    [applyServerPayload],
  )

  const togglePinned = useCallback(
    (rawId) => {
      const id = normFeedbackId(rawId)
      if (!id) return
      setPinned(id, !pinnedIds.has(id))
    },
    [pinnedIds, setPinned],
  )

  return {
    readIds,
    pinnedIds,
    ready,
    mergeFromFeedItems,
    markIdsRead,
    markIdsUnread,
    setPinned,
    setPinnedMany,
    togglePinned,
  }
}
