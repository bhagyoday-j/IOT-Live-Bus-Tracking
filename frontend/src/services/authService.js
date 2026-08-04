import api, { setAccessToken, clearAccessToken } from '../api/axios'

export const loginUser = async (payload) => {
  const { data } = await api.post('/auth/login', payload)
  if (data?.accessToken) {
    setAccessToken(data.accessToken)
  }
  return data
}

export const getCurrentUser = async () => {
  const { data } = await api.get('/auth/me')
  return data
}

export const logoutUser = () => {
  clearAccessToken()
}
