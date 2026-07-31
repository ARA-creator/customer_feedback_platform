const FORMAT_META = {
  csv: { mime: 'text/csv;charset=utf-8;', fallback: 'feedback_export.csv', label: 'CSV' },
  xlsx: {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fallback: 'feedback_export.xlsx',
    label: 'Excel',
  },
  pdf: { mime: 'application/pdf', fallback: 'feedback_export.pdf', label: 'PDF' },
}

export function formatLabel(format) {
  return FORMAT_META[format]?.label || String(format || '').toUpperCase()
}

export async function blobErrorMessage(err) {
  const data = err?.response?.data
  if (!data) return err?.message || 'Failed to download report'
  if (typeof data === 'string') return data
  if (data instanceof Blob) {
    try {
      const text = await data.text()
      const parsed = JSON.parse(text)
      if (parsed?.error) return parsed.error
    } catch {
      /* ignore */
    }
  }
  if (typeof data?.error === 'string') return data.error
  return err?.message || 'Failed to download report'
}

export async function triggerExportDownload(downloadFn, params, format) {
  const fmt = String(format || 'csv').toLowerCase()
  const meta = FORMAT_META[fmt] || FORMAT_META.csv
  const res = await downloadFn(params, fmt)
  const blob = new Blob([res.data], { type: meta.mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const disposition = res.headers?.['content-disposition'] || ''
  const match = /filename="([^"]+)"/.exec(disposition)
  a.href = url
  a.download = match?.[1] || meta.fallback
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
