import api, { setAccessToken, clearAccessToken } from '../api/axios'

export const loginUser = async (payload) => {
  const { data } = await api.post('/auth/login', payload)
  const body = data.data || data
  if (body?.accessToken) {
    setAccessToken(body.accessToken)
  }
  return body
}

export const getCurrentUser = async () => {
  const { data } = await api.get('/auth/me')
  return data.data || data
}

export const logoutUser = () => {
  clearAccessToken()
}
