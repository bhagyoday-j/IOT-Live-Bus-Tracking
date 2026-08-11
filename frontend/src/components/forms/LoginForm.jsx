import { useState } from 'react'
import { Lock, Mail } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { ROLE_HOME, DEMO_ACCOUNTS } from '../../utils/constants'

const LoginForm = () => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: 'test@test.com', password: '123456' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isDemoActive = (account) => form.email === account.email && form.password === account.password

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

      <div className="pt-2">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-slate-400">Demo accounts</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => setForm({ email: account.email, password: account.password })}
              className={`rounded-xl border px-2 py-2 text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-sm ${isDemoActive(account)
                ? 'border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-500 dark:bg-sky-950/50 dark:text-sky-300'
                : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-700'}`}
            >
              {account.label}
            </button>
          ))}
        </div>
      </div>
    </form>
  )
}

export default LoginForm
