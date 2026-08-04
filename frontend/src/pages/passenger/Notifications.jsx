import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import NotificationCard from '../../components/cards/NotificationCard'
import Loader from '../../components/common/Loader'
import ErrorState from '../../components/common/ErrorState'
import EmptyState from '../../components/common/EmptyState'
import { getNotifications } from '../../services/notificationService'
import { PASSENGER_NAV } from '../../utils/constants'

const Notifications = () => {
  const { data = [], isLoading, isError } = useQuery({ queryKey: ['notifications'], queryFn: getNotifications })

  return (
    <DashboardLayout navItems={PASSENGER_NAV}>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-700 dark:text-sky-300">Notifications</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Delay and service alerts</h1>
        </div>

        {isLoading ? <Loader /> : isError ? <ErrorState /> : data.length ? <div className="grid gap-4 md:grid-cols-2">{data.map((item) => <NotificationCard key={item._id} item={item} />)}</div> : <EmptyState title="No alerts" message="No notifications are available from the connected backend right now." />}
      </div>
    </DashboardLayout>
  )
}

export default Notifications
