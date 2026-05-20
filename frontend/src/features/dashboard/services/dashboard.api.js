import { api, getBackendOrigin } from '../../../shared/lib/apiClient'

/** Preserve empty-string query values (e.g. product_group= for NULL-group matches). Axios may omit them otherwise. */
function serializeParams(params) {
  const parts = []
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined) continue
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value === null ? '' : String(value))}`)
  }
  return parts.join('&')
}

const withParamsConfig = (params) =>
  params && Object.keys(params).length > 0 ? { params, paramsSerializer: serializeParams } : undefined

/** Analytics against Neon can exceed the default 10s api client timeout. */
const ANALYTICS_TIMEOUT_MS = 90000

const withAnalyticsTimeout = (config) => ({ ...config, timeout: ANALYTICS_TIMEOUT_MS })

export const getAnalytics = async (params = undefined) => {
  const response = await api.get('/analytics', withAnalyticsTimeout(withParamsConfig(params) || {}))
  return response.data
}

export const getRecentFeedback = async (limit = 50) => {
  const response = await api.get(`/feedback/recent?limit=${limit}`)
  return response.data
}

export const getPriorityQueue = async (limit = 20) => {
  const response = await api.get(`/feedback/priority?limit=${limit}`)
  return response.data
}

export const getProductPulse = async (params = undefined) => {
  const response = await api.get(
    '/analytics/product-pulse',
    withAnalyticsTimeout(withParamsConfig(params) || {}),
  )
  return response.data
}

/** Daily counts per product (primary match) for Insights trend chart */
export const getProductPulseTrend = async (params = undefined) => {
  const response = await api.get(
    '/analytics/product-pulse-trend',
    withAnalyticsTimeout(withParamsConfig(params) || {}),
  )
  return response.data
}

export const getWordCloudUrl = (params = {}) => {
  const base = `${getBackendOrigin()}/api/wordcloud.png`
  const tw = params?.time_window
  if (!tw) return base
  return `${base}?time_window=${encodeURIComponent(String(tw))}`
}

/** Top terms for client-rendered overview word cloud (works on Vercel without wordcloud PNG). */
export const getWordFrequencies = async (params = undefined) => {
  const response = await api.get(
    '/analytics/word-frequencies',
    withAnalyticsTimeout(withParamsConfig(params) || {}),
  )
  return response.data
}

/** AI analysis for overview dashboard time window (all | today | week | last_week | month). */
export const getFeedbackAnalyzer = async (params = undefined) => {
  const response = await api.get('/analytics/analyzer', {
    ...withParamsConfig(params),
    timeout: 90000,
  })
  return response.data
}
