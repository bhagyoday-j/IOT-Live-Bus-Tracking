import { LayoutGrid, MapPinned, Route, ShieldCheck, TrainFront, UserCircle2 } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { ADMIN_NAV, MANAGER_NAV, PASSENGER_NAV } from '../../utils/constants'
import { useAuth } from '../../hooks/useAuth'

const Sidebar = ({ open, onClose }) => {
  const { user } = useAuth()
  const location = useLocation()

  const userRole = user?.role?.toUpperCase()
  const navItems = userRole === 'MANAGER'
    ? MANAGER_NAV
    : userRole === 'ADMIN'
      ? ADMIN_NAV
      : PASSENGER_NAV

  return (
    <aside className={`${open ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-30 w-72 border-r border-slate-200 bg-white p-5 shadow-lg transition-transform duration-200 dark:border-slate-800 dark:bg-slate-950 md:translate-x-0 md:static md:h-auto md:shadow-none`}>
      <div className="flex items-center justify-between md:hidden">
        <span className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Menu</span>
        <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-600 dark:text-slate-300">✕</button>
      </div>
      <div className="mt-8 space-y-2">
        {navItems.map((item) => {
          const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${active ? 'bg-sky-700 text-white' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
            >
              {item.path.includes('track') || item.path.includes('fleet') ? <MapPinned size={16} /> : item.path.includes('routes') ? <Route size={16} /> : item.path.includes('admin') || item.path.includes('manager') ? <LayoutGrid size={16} /> : <UserCircle2 size={16} />}
              {item.label}
            </Link>
          )
        })}
      </div>
      <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
        <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
          <ShieldCheck size={16} className="text-sky-700" />
          Secure operations
        </div>
        <p className="mt-2">Role-based governance with live event handling and public transit analytics.</p>
      </div>
    </aside>
  )
}

export default Sidebar
