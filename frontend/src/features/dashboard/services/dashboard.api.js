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

export const getRecentFeedback = async (limit = 50, params = {}) => {
  const query = { limit, ...params }
  // Neon + decrypt can exceed the default 10s api client timeout (same as analytics).
  const response = await api.get(
    '/feedback/recent',
    withAnalyticsTimeout(withParamsConfig(query) || {}),
  )
  return response.data
}

/** Query params for overview Recent Feedback (matches analytics filters). */
export function buildOverviewRecentFeedbackParams({ sentiment, timeWindow, status } = {}) {
  const params = {}
  const s = String(sentiment || 'all').toLowerCase()
  if (s && s !== 'all') params.sentiment = s
  const tw = String(timeWindow || 'all').toLowerCase()
  if (tw && tw !== 'all') params.time_window = tw
  const st = String(status || 'all').toLowerCase()
  if (st === 'read' || st === 'replied') params.inbox_tab = st
  return params
}

export const getPriorityQueue = async (limit = 20, params = {}) => {
  const query = { limit, ...params }
  const response = await api.get('/feedback/priority', withParamsConfig(query) || {})
  return response.data
}

export const getProductPulse = async (params = undefined) => {
  const response = await api.get(
    '/analytics/product-pulse',
    withAnalyticsTimeout(withParamsConfig(params) || {}),
  )
  return response.data
}

/** Per-product policy insight (sentiment + first/last seen). */
export const getProductDetail = async (params = undefined) => {
  const response = await api.get(
    '/analytics/product-detail',
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

/** AI analysis for overview dashboard time window (all | today | week | month). */
export const getFeedbackAnalyzer = async (params = undefined) => {
  const response = await api.get('/analytics/analyzer', {
    ...withParamsConfig(params),
    timeout: 90000,
  })
  return response.data
}


/** Deep Insights modules (SLA, workforce, drivers, quality, leadership). */
export const getInsightsDeep = async (params = undefined) => {
  const response = await api.get(
    '/analytics/insights-deep',
    withAnalyticsTimeout(withParamsConfig(params) || {}),
  )
  return response.data
}

/** Release before/after for Insights Impact module. */
export const getInsightsReleaseImpact = async (params = undefined) => {
  const response = await api.get(
    '/analytics/insights-release-impact',
    withAnalyticsTimeout(withParamsConfig(params) || {}),
  )
  return response.data
}
