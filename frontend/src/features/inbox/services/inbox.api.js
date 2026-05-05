import { api } from '../../../shared/lib/apiClient'

export const getFeedbackFeed = async (params = {}) => {
  const response = await api.get('/feedback/feed', { params })
  return response.data
}

export const listTeams = async () => {
  const response = await api.get('/teams')
  return response.data
}

export const listAssignableUsers = async ({ team } = {}) => {
  const response = await api.get('/assignable-users', { params: { team: team || undefined } })
  return response.data
}

export const getCustomerProfile = async (customerKey) => {
  const response = await api.get(`/customers/${encodeURIComponent(customerKey)}`)
  return response.data
}

export const getSourceCounts = async ({
  sentiment,
  category,
  priority,
  date_from,
  date_to,
  q,
  location,
  campaign,
  language,
  customer_tier,
  insurance_tag,
  insurance_tags_any,
  dow,
  hour,
  range_days,
} = {}) => {
  const params = {}
  if (sentiment) params.sentiment = sentiment
  if (category) params.category = category
  if (priority) params.priority = priority
  if (date_from) params.date_from = date_from
  if (date_to) params.date_to = date_to
  if (q) params.q = q
  if (location) params.location = location
  if (campaign) params.campaign = campaign
  if (language) params.language = language
  if (customer_tier) params.customer_tier = customer_tier
  if (insurance_tag) params.insurance_tag = insurance_tag
  if (insurance_tags_any) params.insurance_tags_any = insurance_tags_any
  if (dow != null) params.dow = dow
  if (hour != null) params.hour = hour
  if (range_days != null) params.range_days = range_days
  const response = await api.get('/feedback/source-counts', { params })
  return response.data
}

export const createCustomerProfile = async (payload) => {
  const response = await api.post('/customers', payload)
  return response.data
}

export const createCustomerPurchase = async (customerId, payload) => {
  const response = await api.post(`/customers/${customerId}/purchases`, payload)
  return response.data
}

export const createCustomerTicket = async (customerId, payload) => {
  const response = await api.post(`/customers/${customerId}/tickets`, payload)
  return response.data
}

export const upsertCustomerDemographics = async (customerId, payload) => {
  const response = await api.post(`/customers/${customerId}/demographics`, payload)
  return response.data
}

export const getFeedbackWorkflow = async (feedbackId) => {
  const response = await api.get(`/feedback/${feedbackId}/workflow`)
  return response.data
}

export const getFeedbackPolicyMatches = async (feedbackId) => {
  const response = await api.get(`/feedback/${feedbackId}/policy-matches`)
  return response.data
}

export const setPrimaryPolicyMatch = async (feedbackId, policy_hash) => {
  const response = await api.post(`/feedback/${feedbackId}/policy-matches`, {
    set_primary_policy_hash: policy_hash,
  })
  return response.data
}

export const removePolicyMatches = async (feedbackId, policy_hashes) => {
  const response = await api.post(`/feedback/${feedbackId}/policy-matches`, {
    remove_policy_hashes: Array.isArray(policy_hashes) ? policy_hashes : [],
  })
  return response.data
}

export const addPolicyNumber = async (feedbackId, policy_number) => {
  const response = await api.post(`/feedback/${feedbackId}/policy-matches`, {
    add_policy_number: policy_number,
  })
  return response.data
}

export const updateFeedbackWorkflow = async (feedbackId, payload) => {
  const response = await api.post(`/feedback/${feedbackId}/workflow`, payload)
  return response.data
}

export const listFeedbackNotes = async (feedbackId) => {
  const response = await api.get(`/feedback/${feedbackId}/notes`)
  return response.data
}

export const createFeedbackNote = async (feedbackId, payload) => {
  const response = await api.post(`/feedback/${feedbackId}/notes`, payload)
  return response.data
}

export const listReplyDrafts = async (feedbackId) => {
  const response = await api.get(`/feedback/${feedbackId}/draft-replies`)
  return response.data
}

export const createReplyDraft = async (feedbackId, payload) => {
  const response = await api.post(`/feedback/${feedbackId}/draft-replies`, payload)
  return response.data
}

export const generateReplyDraft = async (feedbackId, payload) => {
  const response = await api.post(`/feedback/${feedbackId}/draft-replies/generate`, payload)
  return response.data
}

export const rephraseReplyDraft = async (feedbackId, payload) => {
  const response = await api.post(`/feedback/${feedbackId}/draft-replies/rephrase`, payload)
  return response.data
}

export const approveReplyDraft = async (draftId) => {
  const response = await api.post(`/feedback/replies/${draftId}/approve`, {})
  return response.data
}

export const sendReplyDraft = async (draftId) => {
  const response = await api.post(`/feedback/replies/${draftId}/send`, {})
  return response.data
}

export const markReplySeen = async (draftId, payload) => {
  const response = await api.post(`/feedback/replies/${draftId}/seen`, payload)
  return response.data
}

export const resolveFeedback = async (feedbackId, payload) => {
  const response = await api.post(`/feedback/${feedbackId}/resolution`, payload)
  return response.data
}

export const createMicroSurvey = async (feedbackId, payload) => {
  const response = await api.post(`/feedback/${feedbackId}/micro-survey`, payload)
  return response.data
}
