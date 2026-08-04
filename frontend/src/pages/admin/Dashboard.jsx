import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import AnalyticsCard from '../../components/cards/AnalyticsCard'
import Loader from '../../components/common/Loader'
import ErrorState from '../../components/common/ErrorState'
import { getAdminDashboard } from '../../services/busService'
import { ADMIN_NAV } from '../../utils/constants'

const AdminDashboard = () => {
  const { data, isLoading, isError } = useQuery({ queryKey: ['admin-dashboard'], queryFn: getAdminDashboard })

  return (
    <DashboardLayout navItems={ADMIN_NAV}>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-700 dark:text-sky-300">Admin portal</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">System administration</h1>
        </div>

        {isLoading ? <Loader /> : isError ? <ErrorState /> : (
          <div className="grid gap-4 md:grid-cols-4">
            <AnalyticsCard title="Buses" value={data.buses} subtitle="Tracked fleet" />
            <AnalyticsCard title="Routes" value={data.routes} subtitle="Transit corridors" />
            <AnalyticsCard title="Drivers" value={data.drivers} subtitle="Staff roster" />
            <AnalyticsCard title="Users" value={data.users} subtitle="Active accounts" tone="success" />
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default AdminDashboard
