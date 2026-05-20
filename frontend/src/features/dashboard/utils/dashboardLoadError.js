/**
 * User-facing message when overview/insights dashboard data fails to load.
 */
export function formatDashboardLoadError(err, { useDevProxy = false } = {}) {
  const code = err?.code
  const status = err?.response?.status
  const msg = String(err?.message || '')
  const detail =
    typeof err?.response?.data?.error === 'string'
      ? err.response.data.error
      : ''

  if (
    code === 'ECONNREFUSED' ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('Network Error') ||
    msg.includes('ERR_CONNECTION_REFUSED')
  ) {
    return useDevProxy
      ? 'Cannot reach Flask on 127.0.0.1:5000. From the repo root run: ./scripts/dev/start_backend.sh — then refresh this page.'
      : 'Cannot reach the API server. Start Flask and refresh this page.'
  }

  if (code === 'ECONNABORTED' || msg.toLowerCase().includes('timeout')) {
    return 'Dashboard request timed out (the database query can be slow on Neon). Try again or use a shorter time window.'
  }

  if (status === 401) {
    return detail || 'Session expired. Please sign in again.'
  }

  if (status === 403) {
    return detail || 'You do not have permission to view this dashboard data.'
  }

  if (status >= 500) {
    return detail
      ? `Server error (${status}): ${detail}`
      : `Server error (${status}). Check the Flask terminal for logs.`
  }

  if (detail) return detail

  if (useDevProxy) {
    return `Failed to load dashboard data (${msg || 'unknown'}). Ensure Flask is running on 127.0.0.1:5000 (see VITE_PROXY_TARGET in vite.config.js).`
  }

  return `Failed to load dashboard data. Make sure the Flask API is running.`
}
