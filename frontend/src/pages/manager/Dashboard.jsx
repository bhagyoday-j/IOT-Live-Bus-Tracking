import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import AnalyticsCard from '../../components/cards/AnalyticsCard'
import Loader from '../../components/common/Loader'
import ErrorState from '../../components/common/ErrorState'
import LiveMap from '../../components/maps/LiveMap'
import { getManagerDashboard, getLiveTracking } from '../../services/busService'
import { MANAGER_NAV } from '../../utils/constants'
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis, LineChart, Line } from 'recharts'

const Analytics = () => {
  const { data: dashboard, isLoading, isError } = useQuery({ queryKey: ['manager-dashboard'], queryFn: getManagerDashboard })
  const { data: tracking = [] } = useQuery({ queryKey: ['manager-tracking'], queryFn: getLiveTracking })

  const tripData = [
    { name: 'Mon', trips: 90 },
    { name: 'Tue', trips: 112 },
    { name: 'Wed', trips: 107 },
    { name: 'Thu', trips: 124 },
    { name: 'Fri', trips: 118 },
    { name: 'Sat', trips: 132 },
  ]

  const delayData = [
    { name: 'Mon', delays: 4 },
    { name: 'Tue', delays: 3 },
    { name: 'Wed', delays: 5 },
    { name: 'Thu', delays: 6 },
    { name: 'Fri', delays: 4 },
    { name: 'Sat', delays: 7 },
  ]

  return (
    <DashboardLayout navItems={MANAGER_NAV}>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-700 dark:text-sky-300">Depot manager portal</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Operations dashboard</h1>
        </div>

        {isLoading ? <Loader /> : isError ? <ErrorState /> : (
          <div className="grid gap-4 md:grid-cols-4">
            <AnalyticsCard title="Active buses" value={dashboard.activeBuses} subtitle="In service" />
            <AnalyticsCard title="Delayed buses" value={dashboard.delayedBuses} subtitle="Service interruptions" tone="danger" />
            <AnalyticsCard title="Cancelled buses" value={dashboard.cancelledBuses} subtitle="Risk events" tone="danger" />
            <AnalyticsCard title="Active routes" value={dashboard.activeRoutes} subtitle="Operational network" tone="success" />
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-xl font-semibold">Trips per day</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tripData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="trips" fill="#0F4C81" /></BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-xl font-semibold">Delay trend</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={delayData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Line type="monotone" dataKey="delays" stroke="#E74C3C" strokeWidth={3} /></LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-xl font-semibold">Live bus map</h2>
          <div className="mt-4">
            <LiveMap buses={tracking} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default Analytics
