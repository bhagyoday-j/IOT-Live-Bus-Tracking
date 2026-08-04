import { useState } from 'react'
import { Lock, Mail } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { ROLE_HOME } from '../../utils/constants'

const LoginForm = () => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: 'test@test.com', password: '123456' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = await login(form)
      const role = data?.user?.role?.toUpperCase() || 'PASSENGER'
      navigate(ROLE_HOME[role] || '/')
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to sign in right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
          <Mail size={16} className="text-slate-400" />
          <input
            type="email"
            required
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            className="w-full bg-transparent outline-none"
          />
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Password</label>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
          <Lock size={16} className="text-slate-400" />
          <input
            type="password"
            required
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            className="w-full bg-transparent outline-none"
          />
        </div>
      </div>
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200">{error}</p> : null}
      <button type="submit" disabled={loading} className="w-full rounded-2xl bg-sky-700 px-4 py-3 font-semibold text-white transition hover:bg-sky-800 disabled:opacity-70">
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  )
}

export default LoginForm
