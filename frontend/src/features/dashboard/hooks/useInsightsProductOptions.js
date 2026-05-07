import { useEffect, useMemo } from 'react'

export function useInsightsProductParams(insightsProductKey) {
  return useMemo(() => {
    if (!insightsProductKey) return {}
    const i = insightsProductKey.indexOf('|')
    const prefix = i >= 0 ? insightsProductKey.slice(0, i) : insightsProductKey
    const group = i >= 0 ? insightsProductKey.slice(i + 1) : ''
    if (!String(prefix).trim()) return {}
    return { product_prefix: String(prefix).trim(), product_group: group }
  }, [insightsProductKey])
}

export function useInsightsProductOptions({
  enabled,
  getProductPulse,
  insightsRange,
  insightsProductKey,
  setInsightsProductKey,
  setInsightsProductOptions,
  insightsProductOptions,
}) {
  useEffect(() => {
    if (!enabled) {
      setInsightsProductOptions([])
      setInsightsProductKey('')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const pulse = await getProductPulse({ range_days: insightsRange })
        if (cancelled) return
        const items = Array.isArray(pulse?.items) ? pulse.items : []
        const opts = items
          .map((r) => {
            const prefix = String(r.product_prefix || '').trim()
            const rawG = r.product_group
            const group = rawG == null ? '' : String(rawG)
            const key = `${prefix}|${group}`
            const g = group.trim()
            const p = prefix
            const label = g && p ? `${g} (${p})` : g || p || 'Unknown'
            return { key, label }
          })
          .filter((o) => o.key !== '|')
          .sort((a, b) => String(a.label).localeCompare(String(b.label)))
        setInsightsProductOptions(opts)
      } catch {
        if (!cancelled) setInsightsProductOptions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, getProductPulse, insightsRange, setInsightsProductKey, setInsightsProductOptions])

  useEffect(() => {
    if (!enabled) return
    if (!insightsProductKey) return
    if (!insightsProductOptions.some((o) => o.key === insightsProductKey)) {
      setInsightsProductKey('')
    }
  }, [enabled, insightsProductOptions, insightsProductKey, setInsightsProductKey])
}

