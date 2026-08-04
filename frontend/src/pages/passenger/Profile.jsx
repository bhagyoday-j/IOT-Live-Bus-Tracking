import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import { useAuth } from '../../hooks/useAuth'
import { PASSENGER_NAV } from '../../utils/constants'

const Profile = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <DashboardLayout navItems={PASSENGER_NAV}>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-700 dark:text-sky-300">Profile</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Account information</h1>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-sm text-slate-500">Name</p>
              <p className="mt-2 text-lg font-semibold">{user?.name || '—'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-sm text-slate-500">Email</p>
              <p className="mt-2 text-lg font-semibold">{user?.email || '—'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-sm text-slate-500">Role</p>
              <p className="mt-2 text-lg font-semibold">{user?.role || '—'}</p>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="mt-6 rounded-2xl bg-sky-700 px-4 py-3 font-semibold text-white">Sign out</button>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default Profile
