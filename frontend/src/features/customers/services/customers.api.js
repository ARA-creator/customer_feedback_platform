import { api } from '../../../shared/lib/apiClient'

export async function getCustomerProfile(customerKey) {
  const key = String(customerKey || '').trim()
  if (!key) throw new Error('customerKey is required')
  const res = await api.get(`/customers/${encodeURIComponent(key)}`)
  return res.data
}

