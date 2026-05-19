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

export const getAnalytics = async (params = undefined) => {
  const response = await api.get('/analytics', withParamsConfig(params))
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
  const response = await api.get('/analytics/product-pulse', withParamsConfig(params))
  return response.data
}

/** Daily counts per product (primary match) for Insights trend chart */
export const getProductPulseTrend = async (params = undefined) => {
  const response = await api.get('/analytics/product-pulse-trend', withParamsConfig(params))
  return response.data
}

export const getWordCloudUrl = () => `${getBackendOrigin()}/api/wordcloud.png`

/** AI analysis for overview dashboard time window (all | today | week | last_week | month). */
export const getFeedbackAnalyzer = async (params = undefined) => {
  const response = await api.get('/analytics/analyzer', {
    ...withParamsConfig(params),
    timeout: 90000,
  })
  return response.data
}
