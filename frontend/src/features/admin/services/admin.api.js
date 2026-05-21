import { api } from '../../../shared/lib/apiClient'

export const adminListUsers = async ({ scope = 'active' } = {}) => {
  const response = await api.get('/admin/users', { params: { scope } })
  return response.data
}

export const adminCreateUser = async (payload) => {
  const response = await api.post('/admin/users', payload)
  return response.data
}

export const adminSetUserRoles = async (userId, roles) => {
  const response = await api.post(`/admin/users/${userId}/roles`, { roles })
  return response.data
}

export const adminListRoles = async () => {
  const response = await api.get('/admin/roles')
  return response.data
}

export const adminSetRolePermissions = async (roleId, { permission_keys }) => {
  const response = await api.post(`/admin/roles/${roleId}/permissions`, { permission_keys })
  return response.data
}

export const adminListPermissions = async () => {
  const response = await api.get('/admin/permissions')
  return response.data
}

export const adminSetUserScope = async (userId, { team, region }) => {
  const response = await api.post(`/admin/users/${userId}/scope`, { team, region })
  return response.data
}

export const adminSetUserStatus = async (userId, { is_active }) => {
  const response = await api.post(`/admin/users/${userId}/status`, { is_active })
  return response.data
}

export const adminResetUserPassword = async (userId, { password, confirm_password }) => {
  const response = await api.post(`/admin/users/${userId}/reset-password`, {
    password,
    confirm_password,
  })
  return response.data
}

export const adminApproveUser = async (userId, { roles, primary_role }) => {
  const response = await api.post(`/admin/users/${userId}/approve`, { roles, primary_role })
  return response.data
}

export const adminRejectUser = async (userId, { reason } = {}) => {
  const response = await api.post(`/admin/users/${userId}/reject`, { reason })
  return response.data
}

export const adminDeleteUser = async (userId) => {
  const response = await api.delete(`/admin/users/${userId}`)
  return response.data
}

export const adminRestoreUser = async (userId) => {
  const response = await api.post(`/admin/users/${userId}/restore`, {})
  return response.data
}

export const adminPurgeUser = async (userId) => {
  const response = await api.post(`/admin/users/${userId}/purge`, {})
  return response.data
}

/** GET /api/admin/overview — org snapshot with live queue metrics. */
export const adminGetOverview = async () => {
  const response = await api.get('/admin/overview')
  return response.data
}

/** POST /api/admin/reprocess-insurance-tags — query params only (no JSON body). */
export const adminReprocessInsuranceTags = async (params = {}) => {
  const response = await api.post('/admin/reprocess-insurance-tags', null, { params })
  return response.data
}

/** POST /api/admin/reprocess-sentiment — query params only (no JSON body). */
export const adminReprocessSentiment = async (params = {}) => {
  const response = await api.post('/admin/reprocess-sentiment', null, { params })
  return response.data
}

export const adminApproveReplyDraft = async (draftId, { note } = {}) => {
  const response = await api.post(`/feedback/replies/${draftId}/approve`, { note })
  return response.data
}

export const adminRejectReplyDraft = async (draftId, { note }) => {
  const response = await api.post(`/feedback/replies/${draftId}/reject`, { note })
  return response.data
}

export const adminAssignReplyApprover = async (draftId, { approver_user_id } = {}) => {
  const response = await api.post(`/feedback/replies/${draftId}/assign-approver`, { approver_user_id })
  return response.data
}

export const adminIntegrationsStatus = async () => {
  const response = await api.get('/admin/integrations/status')
  return response.data
}

// --- Release impact tracker ---

export const adminListReleaseEvents = async () => {
  const response = await api.get('/admin/release-events')
  return response.data
}

export const adminCreateReleaseEvent = async (payload) => {
  const response = await api.post('/admin/release-events', payload)
  return response.data
}

export const adminUpdateReleaseEvent = async (releaseId, payload) => {
  const response = await api.post(`/admin/release-events/${releaseId}`, payload)
  return response.data
}

export const adminDeleteReleaseEvent = async (releaseId) => {
  const response = await api.delete(`/admin/release-events/${releaseId}`)
  return response.data
}

export const adminGetReleaseImpact = async ({ release_id, window_days = 7, product_prefix, source, location } = {}) => {
  const params = { release_id, window_days }
  if (product_prefix) params.product_prefix = product_prefix
  if (source) params.source = source
  if (location) params.location = location
  const response = await api.get('/analytics/release-impact', { params })
  return response.data
}

// --- Database connection settings ---

export const adminGetDbConfig = async () => {
  const response = await api.get('/admin/db/config')
  return response.data
}

export const adminTestDbConnection = async (payload) => {
  const response = await api.post('/admin/db/test', payload)
  return response.data
}

export const adminSaveDbConnection = async (payload) => {
  const response = await api.post('/admin/db/save', payload)
  return response.data
}

// --- Enterprise SSO (Azure AD) ---

export const adminGetEnterpriseAuth = async () => {
  const response = await api.get('/admin/auth/enterprise')
  return response.data
}

export const adminTestEnterpriseAuth = async (payload) => {
  const response = await api.post('/admin/auth/enterprise/test', payload)
  return response.data
}

export const adminSaveEnterpriseAuth = async (payload) => {
  const response = await api.post('/admin/auth/enterprise', payload)
  return response.data
}

