import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import Loader from '../../components/common/Loader'
import ErrorState from '../../components/common/ErrorState'
import LiveMap from '../../components/maps/LiveMap'
import { getLiveTracking } from '../../services/busService'
import { PASSENGER_NAV } from '../../utils/constants'

const LiveTracking = () => {
  const { data = [], isLoading, isError } = useQuery({ queryKey: ['live-tracking'], queryFn: getLiveTracking })

  return (
    <DashboardLayout navItems={PASSENGER_NAV}>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-700 dark:text-sky-300">Live tracking</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Real-time fleet visibility</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Monitor moving buses, estimated arrival, and operational condition directly on the map.</p>
        </div>

        {isLoading ? <Loader /> : isError ? <ErrorState /> : <LiveMap buses={data} />}
      </div>
    </DashboardLayout>
  )
}

export default LiveTracking
