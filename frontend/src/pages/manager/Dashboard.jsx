import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import AnalyticsCard from '../../components/cards/AnalyticsCard'
import Loader from '../../components/common/Loader'
import ErrorState from '../../components/common/ErrorState'
import LiveMap from '../../components/maps/LiveMap'
import { getManagerDashboard, getLiveTracking } from '../../services/busService'
import { getFleetIntelligence, getDelayTrends, getTripDistribution } from '../../services/healthService'
import { MANAGER_NAV } from '../../utils/constants'
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis, LineChart, Line } from 'recharts'
import { HeartPulse, Shield, Wrench, Siren } from 'lucide-react'

const ManagerDashboard = () => {
  const { data: dashboard, isLoading, isError } = useQuery({ queryKey: ['manager-dashboard'], queryFn: getManagerDashboard })
  const { data: tracking = [] } = useQuery({ queryKey: ['manager-tracking'], queryFn: getLiveTracking })
  const { data: intel } = useQuery({ queryKey: ['manager-intelligence'], queryFn: getFleetIntelligence, refetchInterval: 30000 })
  const { data: delayTrends = [] } = useQuery({ queryKey: ['manager-delay-trends'], queryFn: () => getDelayTrends(7) })
  const { data: tripDistribution = [] } = useQuery({ queryKey: ['manager-trip-distribution'], queryFn: getTripDistribution })

  const intelligence = intel?.intelligence

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

        {/* SmartTransit AI intelligence cards */}
        {intelligence && (
          <div className="grid gap-4 md:grid-cols-4">
            <IntelligenceCard
              icon={<HeartPulse size={18} />}
              title="Healthy buses"
              value={intelligence.health.healthy}
              critical={intelligence.health.critical}
              subtitle={`${intelligence.health.warning} warning · ${intelligence.health.critical} critical`}
              tone="success"
            />
            <IntelligenceCard
              icon={<Shield size={18} />}
              title="Safety average"
              value={`${intelligence.safety.fleetAverage}`}
              subtitle={`${intelligence.safety.eventsToday} events today`}
              tone="success"
            />
            <IntelligenceCard
              icon={<Wrench size={18} />}
              title="Maintenance open"
              value={intelligence.maintenance.open}
              subtitle={`${intelligence.maintenance.highRisk.length} due within 5 days`}
              tone={intelligence.maintenance.highRisk.length ? 'danger' : 'default'}
            />
            <IntelligenceCard
              icon={<Siren size={18} />}
              title="Accident alerts"
              value={intelligence.accidents.automatic}
              subtitle={`${intelligence.accidents.manual} manual SOS`}
              tone={intelligence.accidents.automatic ? 'danger' : 'default'}
            />
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-xl font-semibold">Trips per hour (today)</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tripDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="trips" fill="#0F4C81" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-xl font-semibold">Delay trend (7 days)</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={delayTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={1} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="delays" stroke="#E74C3C" strokeWidth={3} dot={false} />
                </LineChart>
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

const IntelligenceCard = ({ icon, title, value, subtitle, tone = 'default' }) => (
  <div className={`rounded-2xl border p-5 shadow-sm ${tone === 'danger'
    ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200'
    : tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200'
      : 'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'}`}>
    <div className="flex items-center gap-2 text-sm font-medium opacity-80">{icon}{title}</div>
    <p className="mt-3 text-3xl font-semibold">{value}</p>
    <p className="mt-2 text-sm opacity-70">{subtitle}</p>
  </div>
)

export default ManagerDashboard
