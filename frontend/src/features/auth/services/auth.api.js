import { api } from '../../../shared/lib/apiClient'

export const authMe = async () => {
  const response = await api.get('/auth/me')
  return response.data
}

export const authSignup = async ({ email, password, role }) => {
  const response = await api.post('/auth/signup', { email, password, role })
  return response.data
}

export const authLogin = async ({ email, password }) => {
  const response = await api.post('/auth/login', { email, password })
  return response.data
}

export const authLogout = async () => {
  const response = await api.post('/auth/logout', {})
  return response.data
}
