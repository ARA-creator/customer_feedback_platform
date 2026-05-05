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

export const downloadCustomReportCsv = async (params = {}) => {
  const response = await api.get('/reports/custom.csv', {
    params,
    responseType: 'blob',
  })
  return response
}
