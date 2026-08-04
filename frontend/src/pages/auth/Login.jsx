import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/layouts/AuthLayout'
import LoginForm from '../../components/forms/LoginForm'
import { useAuth } from '../../hooks/useAuth'
import { ROLE_HOME } from '../../utils/constants'

const Login = () => {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) {
      const role = user.role?.toUpperCase() || 'PASSENGER'
      navigate(ROLE_HOME[role] || '/')
    }
  }, [loading, user, navigate])

  return (
    <AuthLayout>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700 dark:text-sky-300">Access portal</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Sign in</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Use the configured credentials to continue into the appropriate transit workspace.</p>
        </div>
        <LoginForm />
      </div>
    </AuthLayout>
  )
}

export default Login
