import { api, setCsrfToken } from '../../../shared/lib/apiClient'
import { clearAuthSession, setAuthSession } from '../../../shared/lib/authSession'

function applyAuthPayload(data) {
  if (data?.access_token || data?.csrf) {
    setAuthSession({ accessToken: data.access_token, csrf: data.csrf })
  }
  if (data?.csrf) setCsrfToken(data.csrf)
}

export const authConfig = async () => {
  const response = await api.get('/auth/config')
  return response.data
}

export const authMe = async () => {
  const response = await api.get('/auth/me')
  applyAuthPayload(response?.data)
  return response.data
}

export const authSignup = async ({ email, password, name, account_type = 'external' }) => {
  const response = await api.post('/auth/signup', { email, password, name, account_type })
  applyAuthPayload(response?.data)
  return response.data
}

export const authLogin = async ({ email, password }) => {
  const response = await api.post('/auth/login', { email, password })
  applyAuthPayload(response?.data)
  return response.data
}

export const authLogout = async () => {
  try {
    const response = await api.post('/auth/logout', {})
    return response.data
  } finally {
    clearAuthSession()
    setCsrfToken('')
  }
}

export const authUpdateProfile = async ({ full_name } = {}) => {
  const response = await api.patch('/auth/profile', { full_name })
  return response.data
}

export const authChangePassword = async ({ current_password, new_password, confirm_password }) => {
  const response = await api.post('/auth/change-password', {
    current_password,
    new_password,
    confirm_password,
  })
  return response.data
}
