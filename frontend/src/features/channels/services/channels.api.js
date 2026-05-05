import { api, axios, getBackendOrigin } from '../../../shared/lib/apiClient'

export { getBackendOrigin }

export const getChannelsStatus = async () => {
  const response = await api.get('/channels/status')
  return response.data
}

export const triggerXPoll = async ({ max_results = 25 } = {}) => {
  const response = await axios.post(
    `${getBackendOrigin()}/integrations/x/poll`,
    { max_results },
    { timeout: 90000, headers: { 'Content-Type': 'application/json' }, withCredentials: true }
  )
  return response.data
}

export const triggerTikTokPoll = async ({ query = 'enterprise ghana', limit = 25 } = {}) => {
  const response = await axios.post(
    `${getBackendOrigin()}/integrations/tiktok/poll`,
    { query, limit },
    { timeout: 90000, headers: { 'Content-Type': 'application/json' }, withCredentials: true }
  )
  return response.data
}
