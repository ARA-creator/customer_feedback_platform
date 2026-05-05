import { api } from '../../../shared/lib/apiClient'

export const submitFeedback = async (feedbackData) => {
  const response = await api.post('/feedback', feedbackData)
  return response.data
}
