export function computePeakTimesTotals(peakTimes) {
  const rows = Array.isArray(peakTimes) ? peakTimes : []
  if (rows.length === 0) return { total: 0, max: 0 }
  let total = 0
  let max = 0
  for (const pt of rows) {
    const c = Number(pt?.count) || 0
    total += c
    if (c > max) max = c
  }
  return { total, max }
}

export function pivotCategoryTrends(categoryTrends, { topN = 6 } = {}) {
  const rows = Array.isArray(categoryTrends) ? categoryTrends : []
  if (rows.length === 0) return { data: [], categories: [] }

  const totals = new Map()
  for (const r of rows) {
    const cat = String(r?.category || 'Uncategorized')
    const c = Number(r?.count) || 0
    totals.set(cat, (totals.get(cat) || 0) + c)
  }

  const topCats = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([cat]) => cat)

  const byDate = new Map()
  for (const r of rows) {
    const date = String(r?.date || '')
    if (!date) continue
    const cat = String(r?.category || 'Uncategorized')
    if (!topCats.includes(cat)) continue
    const c = Number(r?.count) || 0
    const bucket = byDate.get(date) || { date }
    bucket[cat] = (bucket[cat] || 0) + c
    byDate.set(date, bucket)
  }

  const data = Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)))
  return { data, categories: topCats }
}

export function pivotProductPulseTrends(productPulseTrends, { topN = 6 } = {}) {
  const rows = Array.isArray(productPulseTrends) ? productPulseTrends : []
  if (rows.length === 0) return { data: [], products: [] }

  const totals = new Map()
  for (const r of rows) {
    const p = String(r?.product || 'Unknown')
    const c = Number(r?.count) || 0
    totals.set(p, (totals.get(p) || 0) + c)
  }

  const topProducts = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name]) => name)

  const byDate = new Map()
  for (const r of rows) {
    const date = String(r?.date || '')
    if (!date) continue
    const p = String(r?.product || 'Unknown')
    if (!topProducts.includes(p)) continue
    const c = Number(r?.count) || 0
    const bucket = byDate.get(date) || { date }
    bucket[p] = (bucket[p] || 0) + c
    byDate.set(date, bucket)
  }

  const data = Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)))
  return { data, products: topProducts }
}

