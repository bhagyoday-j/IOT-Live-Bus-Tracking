import { ArrowRight, BusFront } from 'lucide-react'
import { Link } from 'react-router-dom'

const BusCard = ({ bus }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-sky-100 p-2 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
          <BusFront size={18} />
        </div>
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{bus.busNumber}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{bus.routeName || bus.route}</p>
        </div>
      </div>
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
        {bus.status}
      </span>
    </div>
    <div className="mt-4 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
      <span>Current speed: {bus.currentSpeed ?? '—'} km/h</span>
      <Link to={`/bus/${bus._id || bus.busId}`} className="flex items-center gap-1 font-semibold text-sky-700 dark:text-sky-300">
        View details <ArrowRight size={15} />
      </Link>
    </div>
  </div>
)

export default BusCard
