import { api, setCsrfToken } from '../../../shared/lib/apiClient'

export const authConfig = async () => {
  const response = await api.get('/auth/config')
  return response.data
}

export const authMe = async () => {
  const response = await api.get('/auth/me')
  if (response?.data?.csrf) setCsrfToken(response.data.csrf)
  return response.data
}

export const authSignup = async ({ email, password, name, account_type = 'external' }) => {
  const response = await api.post('/auth/signup', { email, password, name, account_type })
  if (response?.data?.csrf) setCsrfToken(response.data.csrf)
  return response.data
}

export const authLogin = async ({ email, password }) => {
  const response = await api.post('/auth/login', { email, password })
  if (response?.data?.csrf) setCsrfToken(response.data.csrf)
  return response.data
}

export const authLogout = async () => {
  const response = await api.post('/auth/logout', {})
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
