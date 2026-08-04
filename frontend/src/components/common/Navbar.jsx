import { Menu, Moon, Sun, TrainFront } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { APP_NAME } from '../../utils/constants'
import { useAuth } from '../../hooks/useAuth'

const Navbar = ({ navItems = [], onToggleSidebar }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('smarttransit-theme') === 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('smarttransit-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="rounded-full border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
          >
            <Menu size={18} />
          </button>
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <span className="rounded-full bg-sky-700 p-2 text-white">
              <TrainFront size={16} />
            </span>
            {APP_NAME}
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-3 md:flex">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path} className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                {item.label}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => setDarkMode((current) => !current)}
            className="rounded-full border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full bg-sky-700 px-3 py-2 text-sm font-medium text-white"
            >
              Logout
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}

export default Navbar
