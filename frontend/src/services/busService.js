import api from '../api/axios'

export const getBuses = async () => {
  const { data } = await api.get('/buses')
  return (data.data || []).map((bus) => ({
    _id: bus._id,
    busNumber: bus.number,
    route: bus.routeId?.name || null,
    routeName: bus.routeId?.name || null,
    status: bus.status,
    currentSpeed: bus.currentLocation?.speed || 0,
    busType: bus.busType,
    capacity: bus.capacity,
  }))
}

export const getBusById = async (id) => {
  const { data } = await api.get(`/buses/${id}`)
  const bus = data.data?.bus || {}
  return {
    ...bus,
    busNumber: bus.number,
    route: bus.routeId?.name || 'Not assigned',
    driver: bus.driverId?.name || null,
    currentSpeed: bus.currentLocation?.speed || 0,
    currentLocation: bus.currentLocation,
    status: bus.status,
    health: bus.health,
  }
}

export const getLiveTracking = async () => {
  const { data } = await api.get('/tracking/live')
  return data.data?.locations || []
}

export const getBusETA = async (id) => {
  const { data } = await api.get(`/gps/bus/${id}/eta`)
  return data.data
}

export const getManagerDashboard = async () => {
  const { data } = await api.get('/dashboard/manager')
  return data.data
}

export const getAdminDashboard = async () => {
  const { data } = await api.get('/dashboard/admin')
  return data.data
}
