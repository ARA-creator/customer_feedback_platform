function csvEscape(value) {
  if (value == null) return ''
  const str = String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

export function buildDashboardSummaryCsv({ metrics, sentimentData, categoryData, trendData }) {
  const rows = []
  rows.push(['Section', 'Key', 'Value'])
  rows.push(['Metrics', 'Total feedback', metrics?.totalFeedback ?? 0])
  rows.push(['Metrics', 'Positive', metrics?.positive ?? 0])
  rows.push(['Metrics', 'Negative', metrics?.negative ?? 0])
  rows.push(['Metrics', 'Neutral', metrics?.neutral ?? 0])
  rows.push(['Metrics', 'High priority', metrics?.highPriority ?? 0])

  ;(sentimentData || []).forEach((s) => {
    if (s?.name && s?.value != null) rows.push(['Sentiment', s.name, s.value])
  })
  ;(categoryData || []).forEach((c) => {
    if (c?.name && c?.value != null) rows.push(['Category', c.name, c.value])
  })

  const header = ['date', 'total', 'positive', 'negative', 'neutral']
  rows.push([])
  rows.push(['Trends (last 30 days)'])
  rows.push(header)
  ;(trendData || []).forEach((t) => {
    rows.push([t?.date || '', t?.total ?? '', t?.positive ?? '', t?.negative ?? '', t?.neutral ?? ''])
  })

  return rows.map((row) => row.map(csvEscape).join(',')).join('\n')
}

export function buildInboxFeedbackCsv(rows) {
  const items = Array.isArray(rows) ? rows : []
  const header = [
    'id',
    'source',
    'customer_id',
    'category',
    'rating',
    'sentiment_label',
    'sentiment_score',
    'priority',
    'created_at',
  ]
  const csvRows = [
    header.join(','),
    ...items.map((item) =>
      header
        .map((field) => `"${String(item?.[field] ?? '').replace(/"/g, '""')}"`)
        .join(','),
    ),
  ]
  return csvRows.join('\n')
}

export function downloadTextFile({ contents, filename, mime }) {
  const blob = new Blob([contents], { type: mime || 'text/plain;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename || 'download.txt')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

