import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ROLE_HOME } from '../utils/constants'

const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const userRole = user.role?.toUpperCase()

  if (allowedRoles.length && !allowedRoles.includes(userRole)) {
    return <Navigate to={ROLE_HOME[userRole] || '/'} replace />
  }

  return <Outlet />
}

export default ProtectedRoute
