import { api, SLOW_API_TIMEOUT_MS } from '../../../shared/lib/apiClient'

export async function getCustomerProfile(customerKey) {
  const key = String(customerKey || '').trim()
  if (!key) throw new Error('customerKey is required')
  const res = await api.get(`/customers/${encodeURIComponent(key)}`, { timeout: SLOW_API_TIMEOUT_MS })
  return res.data
}

