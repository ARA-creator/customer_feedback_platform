import axios from 'axios'

function normalizeBackendOrigin(value) {
  const v = String(value ?? 'http://localhost:5000').trim().replace(/\/+$/, '')
  return v || 'http://localhost:5000'
}

const rawBackend = import.meta.env.VITE_BACKEND_ORIGIN
const trimmedBackend = rawBackend != null ? String(rawBackend).trim() : ''

/**
 * Dev + no explicit VITE_BACKEND_ORIGIN: send /api (and proxied paths) through Vite
 * so the browser does not call localhost:5000 directly (WSL/Windows mismatch).
 */
export const USE_DEV_API_PROXY = import.meta.env.DEV && trimmedBackend === ''

/**
 * When deployed with Vercel Services, frontend + backend share the same origin
 * and the backend is mounted under `/api`. In that case, prefer same-origin
 * requests (empty origin) unless the user explicitly provided VITE_BACKEND_ORIGIN.
 */
const USE_SAME_ORIGIN_BACKEND = !import.meta.env.DEV && trimmedBackend === ''

const BACKEND_ORIGIN =
  USE_DEV_API_PROXY || USE_SAME_ORIGIN_BACKEND
    ? ''
    : normalizeBackendOrigin(trimmedBackend === '' ? undefined : trimmedBackend)

const apiBaseURL =
  USE_DEV_API_PROXY || USE_SAME_ORIGIN_BACKEND
    ? '/api'
    : `${normalizeBackendOrigin(trimmedBackend === '' ? undefined : trimmedBackend)}/api`

export function getBackendOrigin() {
  return BACKEND_ORIGIN
}

/** Full origin for webhook copy URLs and UI (never empty in the browser). */
export function getClipboardBackendOrigin() {
  if (USE_DEV_API_PROXY) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin
    }
    return 'http://localhost:5173'
  }
  return BACKEND_ORIGIN || normalizeBackendOrigin(undefined)
}

const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

if (import.meta.env.DEV) {
  api.interceptors.request.use(
    (config) => {
      console.log(`API Request: ${config.method.toUpperCase()} ${config.url}`)
      return config
    },
    (error) => Promise.reject(error)
  )
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export { api, axios }
