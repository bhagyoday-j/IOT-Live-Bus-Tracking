import api from '../api/axios'

// ── Fleet health / telemetry ────────────────────────────────────────

export const getFleetHealth = async () => {
  const { data } = await api.get('/health/buses')
  return data.data
}

export const getBusHealth = async (id) => {
  const { data } = await api.get(`/health/bus/${id}`)
  return data.data
}

export const getTelemetryHistory = async (id, minutes = 60) => {
  const { data } = await api.get(`/health/bus/${id}/telemetry`, { params: { minutes } })
  return data.data
}

export const simulateAccident = async (busId) => {
  const { data } = await api.post(`/health/simulate/accident/${busId}`)
  return data.data
}

// ── Driver safety ───────────────────────────────────────────────────

export const getDriverSafety = async () => {
  const { data } = await api.get('/safety/drivers')
  return data.data
}

export const getSafetyEvents = async (params = {}) => {
  const { data } = await api.get('/safety/events', { params })
  return data.data
}

export const getSafetyReport = async () => {
  const { data } = await api.get('/analytics/safety')
  return data.data?.safety
}

// ── Predictive maintenance ──────────────────────────────────────────

export const getMaintenanceAlerts = async (params = {}) => {
  const { data } = await api.get('/maintenance/alerts', { params })
  return data.data
}

export const resolveMaintenanceAlert = async (id, notes) => {
  const { data } = await api.put(`/maintenance/alerts/${id}/resolve`, { notes })
  return data.data
}

export const runMaintenanceAnalysis = async () => {
  const { data } = await api.post('/maintenance/analyze')
  return data.data
}

// ── Operational analytics ───────────────────────────────────────────

export const getDelayTrends = async (days = 7) => {
  const { data } = await api.get('/analytics/delay-trends', { params: { days } })
  return data.data?.trends || []
}

export const getTripDistribution = async () => {
  const { data } = await api.get('/analytics/trip-distribution')
  return data.data?.distribution || []
}

// ── Fleet intelligence (combined analytics) ─────────────────────────

export const getFleetIntelligence = async () => {
  const { data } = await api.get('/analytics/fleet-intelligence')
  return data.data
}
