import { CHART_PALETTE } from '../constants/palette'

/** Maps source name keys to stable chart colors for multi-series trends. */
export function buildSourceTrendColorMap(sourceTrends) {
  const sources = Array.isArray(sourceTrends?.sources) ? sourceTrends.sources : []
  const out = {}
  sources.forEach((s, idx) => {
    out[String(s || '')] = CHART_PALETTE[idx % CHART_PALETTE.length]
  })
  return out
}
