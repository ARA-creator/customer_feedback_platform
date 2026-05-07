import { formatInsuranceTagChartLabel } from './dashboardFormatters'

export function sentimentChartHasRealData(sentimentData) {
  const rows = Array.isArray(sentimentData) ? sentimentData : []
  return rows.some((s) => s?.name !== 'No Data' && s?.name !== 'Error' && Number(s?.value) > 0)
}

export function buildThemesBarChartData({ insuranceTagsBreakdown, chartPalette }) {
  const palette = Array.isArray(chartPalette) ? chartPalette : []
  const b = insuranceTagsBreakdown || {}
  const rows = Object.entries(b)
    .map(([k, v], i) => ({
      name: formatInsuranceTagChartLabel(k),
      value: Number(v?.total ?? 0),
      fill: palette.length ? palette[i % palette.length] : undefined,
      _key: k,
    }))
    .filter((r) => Number(r.value) > 0)
    .sort((a, b2) => Number(b2.value) - Number(a.value))
  return rows.length > 0 ? rows : [{ name: 'No data', value: 0, fill: '#d1d5db' }]
}

export function themesChartHasRealData(insuranceTagsBreakdown) {
  const b = insuranceTagsBreakdown || {}
  return Object.values(b).some((v) => Number(v?.total ?? 0) > 0)
}

