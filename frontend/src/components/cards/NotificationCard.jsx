import { AlertTriangle, Clock3 } from 'lucide-react'
import { formatDate } from '../../utils/helpers'

const NotificationCard = ({ item }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-amber-100 p-2 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
          {item.type === 'DELAY' ? <Clock3 size={16} /> : <AlertTriangle size={16} />}
        </div>
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{item.type}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.message}</p>
        </div>
      </div>
    </div>
    <p className="mt-3 text-xs uppercase tracking-[0.24em] text-slate-400">{formatDate(item.createdAt)}</p>
  </div>
)

export default NotificationCard
