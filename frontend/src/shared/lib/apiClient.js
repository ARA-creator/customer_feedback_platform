import axios from 'axios'
import { getAccessToken, getStoredCsrfToken } from './authSession'

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

/**
 * Base URL for integration webhooks (Twilio, Meta, etc.).
 * Vercel mounts Flask under /api; local dev proxies /integrations at site root.
 */
export function getIntegrationsWebhookBase() {
  if (USE_DEV_API_PROXY) {
    return getClipboardBackendOrigin().replace(/\/+$/, '')
  }
  if (USE_SAME_ORIGIN_BACKEND) {
    const o =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin.replace(/\/+$/, '')
        : ''
    return o ? `${o}/api` : '/api'
  }
  return normalizeBackendOrigin(trimmedBackend === '' ? undefined : trimmedBackend)
}

/** Use on Neon-backed routes that decrypt many rows (inbox feed, Customer 360, analytics). */
export const SLOW_API_TIMEOUT_MS = 60000

const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

let csrfToken = ''
export function setCsrfToken(next) {
  csrfToken = String(next || '')
  try {
    if (next) sessionStorage.setItem('cfp_csrf_token', String(next))
  } catch {
    // ignore
  }
}

api.interceptors.request.use((config) => {
  const accessToken = getAccessToken()
  if (accessToken) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  const method = String(config?.method || 'get').toLowerCase()
  const csrf = csrfToken || getStoredCsrfToken()
  if (!['get', 'head', 'options'].includes(method) && csrf) {
    config.headers = config.headers || {}
    config.headers['X-CSRF-Token'] = csrf
  }
  return config
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

function formatAxiosApiErrorPayload(data) {
  if (data == null) return ''
  if (typeof data === 'string') return data
  if (typeof data === 'object') {
    const e = data.error
    if (typeof e === 'string') return e
    if (e && typeof e === 'object') {
      const code = typeof e.code === 'string' ? e.code : ''
      const msg = typeof e.message === 'string' ? e.message : ''
      const joined = [code, msg].filter(Boolean).join(': ')
      if (joined) return joined
    }
    try {
      return JSON.stringify(data)
    } catch {
      return String(data)
    }
  }
  return String(data)
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const cfg = error.config || {}
    const path = cfg.url ? String(cfg.url) : ''
    const base = cfg.baseURL ? String(cfg.baseURL) : ''
    const fullUrl = path.startsWith('http') ? path : `${base}${path}`
    const detail = formatAxiosApiErrorPayload(error.response?.data)
    console.error(`API Error${status != null ? ` ${status}` : ''}`, fullUrl || path || '(unknown url)', detail || error.message)
    return Promise.reject(error)
  }
)

export { api, axios }
