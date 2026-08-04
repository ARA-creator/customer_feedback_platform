/**
 * Merge feedback lists so reloads prepend/update without wiping already-loaded rows.
 * Newer server rows win for shared ids; brand-new ids are prepended in server order.
 */
export function mergeFeedbackItems(prev, incoming, options = {}) {
  const max = options.max
  const prevArr = Array.isArray(prev) ? prev : []
  const nextArr = Array.isArray(incoming) ? incoming : []
  if (!nextArr.length) return prevArr

  const prevById = new Map()
  for (const it of prevArr) {
    const id = Number(it?.id)
    if (Number.isFinite(id)) prevById.set(id, it)
  }

  const brandNew = []
  const updatedById = new Map()
  for (const it of nextArr) {
    const id = Number(it?.id)
    if (!Number.isFinite(id)) continue
    if (prevById.has(id)) updatedById.set(id, it)
    else brandNew.push(it)
  }

  const rest = prevArr.map((it) => {
    const id = Number(it?.id)
    if (!Number.isFinite(id)) return it
    return updatedById.get(id) || it
  })

  const merged = [...brandNew, ...rest]
  if (Number.isFinite(max) && max > 0) return merged.slice(0, max)
  return merged
}

/** Highest numeric feedback id in a list (for incremental after_id refresh). */
export function maxFeedbackId(items) {
  let max = 0
  for (const it of items || []) {
    const id = Number(it?.id)
    if (Number.isFinite(id) && id > max) max = id
  }
  return max > 0 ? max : undefined
}
