import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import AnalyticsCard from '../../components/cards/AnalyticsCard'
import Loader from '../../components/common/Loader'
import ErrorState from '../../components/common/ErrorState'
import { getManagerDashboard } from '../../services/busService'
import { MANAGER_NAV } from '../../utils/constants'
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'

const AnalyticsPage = () => {
  const { data, isLoading, isError } = useQuery({ queryKey: ['manager-analytics'], queryFn: getManagerDashboard })

  const performanceData = [
    { name: 'Jan', value: 75 },
    { name: 'Feb', value: 82 },
    { name: 'Mar', value: 79 },
    { name: 'Apr', value: 88 },
    { name: 'May', value: 91 },
    { name: 'Jun', value: 94 },
  ]

  return (
    <DashboardLayout navItems={MANAGER_NAV}>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-700 dark:text-sky-300">Analytics</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Performance reporting</h1>
        </div>

        {isLoading ? <Loader /> : isError ? <ErrorState /> : (
          <div className="grid gap-4 md:grid-cols-4">
            <AnalyticsCard title="Active buses" value={data.activeBuses} subtitle="Operations underway" />
            <AnalyticsCard title="Delayed buses" value={data.delayedBuses} subtitle="Mitigation in progress" tone="danger" />
            <AnalyticsCard title="Cancelled buses" value={data.cancelledBuses} subtitle="Service alerts" tone="danger" />
            <AnalyticsCard title="Active routes" value={data.activeRoutes} subtitle="Network breadth" tone="success" />
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-xl font-semibold">Fleet utilization trend</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Area type="monotone" dataKey="value" stroke="#2E86DE" fill="#2E86DE" fillOpacity={0.2} /></AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default AnalyticsPage
