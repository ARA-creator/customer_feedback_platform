/**
 * Per-tab auth: access token + CSRF live in sessionStorage so each browser tab
 * can stay signed in as a different user on the same origin.
 */

const ACCESS_KEY = 'cfp_access_token'
const CSRF_KEY = 'cfp_csrf_token'

export function getAccessToken() {
  try {
    return sessionStorage.getItem(ACCESS_KEY) || ''
  } catch {
    return ''
  }
}

export function getStoredCsrfToken() {
  try {
    return sessionStorage.getItem(CSRF_KEY) || ''
  } catch {
    return ''
  }
}

export function setAuthSession({ accessToken, csrf } = {}) {
  try {
    if (accessToken) sessionStorage.setItem(ACCESS_KEY, String(accessToken))
    if (csrf) sessionStorage.setItem(CSRF_KEY, String(csrf))
  } catch {
    // ignore
  }
}

export function clearAuthSession() {
  try {
    sessionStorage.removeItem(ACCESS_KEY)
    sessionStorage.removeItem(CSRF_KEY)
  } catch {
    // ignore
  }
}

/** Pick up ?api_session= from enterprise SSO redirect; strip from the URL. */
export function captureApiSessionFromUrl() {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('api_session')
    if (!token) return false
    setAuthSession({ accessToken: token })
    params.delete('api_session')
    const qs = params.toString()
    const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`
    window.history.replaceState({}, '', next)
    return true
  } catch {
    return false
  }
}
