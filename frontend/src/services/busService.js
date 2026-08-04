import api from '../api/axios'

export const getBuses = async () => {
  const { data } = await api.get('/buses')
  return data
}

export const getBusById = async (id) => {
  const { data } = await api.get(`/buses/${id}`)
  return data
}

export const getLiveTracking = async () => {
  const { data } = await api.get('/tracking/live')
  return data
}

export const getManagerDashboard = async () => {
  const { data } = await api.get('/dashboard/manager')
  return data
}

export const getAdminDashboard = async () => {
  const { data } = await api.get('/dashboard/admin')
  return data
}
