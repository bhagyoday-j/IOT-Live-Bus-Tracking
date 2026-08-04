import api from '../api/axios'

export const getNotifications = async () => {
  const { data } = await api.get('/notifications')
  return data
}
