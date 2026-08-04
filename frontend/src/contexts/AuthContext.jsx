import { createContext, useEffect, useMemo, useState } from 'react'
import { getCurrentUser, loginUser, logoutUser } from '../services/authService'

export const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const response = await getCurrentUser()
        setUser(response?.user ?? null)
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    bootstrap()
  }, [])

  const login = async (credentials) => {
    const data = await loginUser(credentials)
    setUser(data?.user ?? null)
    return data
  }

  const logout = async () => {
    logoutUser()
    setUser(null)
  }

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
