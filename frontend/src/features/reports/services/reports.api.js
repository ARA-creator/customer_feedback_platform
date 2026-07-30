import { api } from '../../../shared/lib/apiClient'

export const listReportSchedules = async () => {
  const response = await api.get('/reports/schedules')
  return response.data
}

export const createReportSchedule = async (payload) => {
  const response = await api.post('/reports/schedules', payload)
  return response.data
}

export const deleteReportSchedule = async (id) => {
  const response = await api.delete(`/reports/schedules/${id}`)
  return response.data
}

/** @param {'csv'|'xlsx'|'pdf'} format */
export const downloadAnalystExport = async (params = {}, format = 'csv') => {
  const fmt = String(format || 'csv').toLowerCase()
  const response = await api.get('/reports/analyst-export', {
    params: { ...params, format: fmt },
    responseType: 'blob',
    timeout: 180000,
  })
  return response
}

/** @deprecated prefer downloadAnalystExport(params, 'csv') */
export const downloadAnalystExportCsv = async (params = {}) => downloadAnalystExport(params, 'csv')

export const downloadCustomReportCsv = async (params = {}) => {
  const response = await api.get('/reports/custom.csv', {
    params,
    responseType: 'blob',
    timeout: 180000,
  })
  return response
}
