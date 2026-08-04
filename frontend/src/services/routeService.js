import api from '../api/axios'

export const planRoute = async (payload) => {
  const { data } = await api.post('/routes/plan', payload)
  return data
}
