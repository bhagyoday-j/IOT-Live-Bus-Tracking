import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import Loader from '../../components/common/Loader'
import ErrorState from '../../components/common/ErrorState'
import LiveMap from '../../components/maps/LiveMap'
import { getLiveTracking } from '../../services/busService'
import { MANAGER_NAV } from '../../utils/constants'

const FleetTracking = () => {
  const { data = [], isLoading, isError } = useQuery({ queryKey: ['fleet-tracking'], queryFn: getLiveTracking })

  return (
    <DashboardLayout navItems={MANAGER_NAV}>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-700 dark:text-sky-300">Fleet tracking</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Monitor vehicle movement</h1>
        </div>
        {isLoading ? <Loader /> : isError ? <ErrorState /> : <LiveMap buses={data} />}
      </div>
    </DashboardLayout>
  )
}

export default FleetTracking
