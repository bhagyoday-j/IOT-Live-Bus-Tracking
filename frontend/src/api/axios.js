import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api',
  withCredentials: true,
})

const TOKEN_KEY = 'st_access_token'

let accessToken = localStorage.getItem(TOKEN_KEY) || null

export const setAccessToken = (token) => {
  accessToken = token
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export const clearAccessToken = () => {
  accessToken = null
  localStorage.removeItem(TOKEN_KEY)
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAccessToken()
    }

    return Promise.reject(error)
  },
)

export default api
