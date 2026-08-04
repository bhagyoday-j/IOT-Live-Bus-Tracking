import { Link } from 'react-router-dom'
import { APP_NAME, APP_TAGLINE } from '../../utils/constants'

const AuthLayout = ({ children }) => (
  <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(46,134,222,0.26),_transparent_32%),linear-gradient(135deg,_#f8fbff_0%,_#eef4fb_100%)] px-4 py-10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(46,134,222,0.26),_transparent_32%),linear-gradient(135deg,_#020617_0%,_#0f172a_100%)]">
    <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-center">
      <div className="max-w-xl space-y-4 rounded-3xl border border-white/50 bg-white/70 p-8 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700 dark:text-sky-300">Secure public transit operations</p>
        <h1 className="text-4xl font-semibold text-slate-900 dark:text-white">{APP_NAME}</h1>
        <p className="text-lg text-slate-600 dark:text-slate-300">{APP_TAGLINE}</p>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
          Passenger, depot manager, and administrative workflows are unified in a single resilient platform.
        </div>
      </div>
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950">
        {children}
      </div>
    </div>
  </div>
)

export default AuthLayout
