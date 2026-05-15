import { api, setCsrfToken } from '../../../shared/lib/apiClient'

export const authMe = async () => {
  const response = await api.get('/auth/me')
  if (response?.data?.csrf) setCsrfToken(response.data.csrf)
  return response.data
}

export const authSignup = async ({ email, password, role }) => {
  const response = await api.post('/auth/signup', { email, password, role })
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

export const authVerifyEmail = async ({ email, code }) => {
  const response = await api.post('/auth/verify-email', { email, code })
  return response.data
}

export const authForgotPassword = async ({ email }) => {
  const response = await api.post('/auth/forgot-password', { email })
  return response.data
}

export const authVerifyResetCode = async ({ email, code }) => {
  const response = await api.post('/auth/verify-reset-code', { email, code })
  return response.data
}

export const authResetPassword = async ({ email, code, password }) => {
  const response = await api.post('/auth/reset-password', { email, code, password })
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
