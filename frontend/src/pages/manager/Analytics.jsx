import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import AnalyticsCard from '../../components/cards/AnalyticsCard'
import Loader from '../../components/common/Loader'
import ErrorState from '../../components/common/ErrorState'
import EmptyState from '../../components/common/EmptyState'
import { getFleetIntelligence, getDelayTrends } from '../../services/healthService'
import { MANAGER_NAV } from '../../utils/constants'
import { formatDate } from '../../utils/helpers'
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { Shield, Wrench, Siren } from 'lucide-react'

const AnalyticsPage = () => {
  const { data, isLoading, isError } = useQuery({ queryKey: ['manager-analytics'], queryFn: getFleetIntelligence, refetchInterval: 60000 })
  const { data: delayTrends = [] } = useQuery({ queryKey: ['analytics-delay-trends'], queryFn: () => getDelayTrends(7) })

  const intelligence = data?.intelligence

  const healthDistribution = intelligence ? [
    { name: 'Healthy', value: intelligence.health.healthy, fill: '#27AE60' },
    { name: 'Warning', value: intelligence.health.warning, fill: '#F39C12' },
    { name: 'Critical', value: intelligence.health.critical, fill: '#E74C3C' },
    { name: 'Unknown', value: intelligence.health.unknown, fill: '#94A3B8' },
  ] : []

  return (
    <DashboardLayout navItems={MANAGER_NAV}>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-700 dark:text-sky-300">Analytics</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">SmartTransit AI intelligence</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Driver safety reports, maintenance alerts, accident history and vehicle health status at a glance.
          </p>
        </div>

        {isLoading ? <Loader /> : isError ? <ErrorState /> : intelligence ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <AnalyticsCard title="Fleet safety average" value={intelligence.safety.fleetAverage} subtitle="Driver safety score" tone="success" />
              <AnalyticsCard title="Open maintenance" value={intelligence.maintenance.open} subtitle={`${intelligence.maintenance.highRisk.length} high risk`} tone="danger" />
              <AnalyticsCard title="Critical health" value={intelligence.health.critical} subtitle="Buses needing attention" tone="danger" />
              <AnalyticsCard title="Accidents (7d)" value={intelligence.accidents.total} subtitle={`${intelligence.accidents.automatic} automatic detections`} tone="danger" />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h2 className="text-xl font-semibold">Vehicle health status</h2>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={healthDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {healthDistribution.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h2 className="text-xl font-semibold">Delay rate trend</h2>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={delayTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={1} />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="delayRate" name="Delay %" stroke="#2E86DE" fill="#2E86DE" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <Shield size={20} className="text-emerald-600" /> Driver safety reports
                </h2>
                <div className="mt-4 space-y-3">
                  {intelligence.safety.drivers.length === 0 && <EmptyState title="No reports" message="Safety reports build up as driving events are recorded." />}
                  {intelligence.safety.drivers.slice(0, 8).map((driver) => (
                    <div key={driver.driverId} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{driver.name}</p>
                          <p className="text-xs text-slate-500">{driver.totalEvents} event(s) · {driver.trend}</p>
                        </div>
                        <p className={`text-xl font-bold ${driver.score >= 90 ? 'text-emerald-600' : driver.score >= 75 ? 'text-amber-600' : 'text-rose-600'}`}>{driver.score}</p>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full ${driver.score >= 90 ? 'bg-emerald-500' : driver.score >= 75 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${driver.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <h2 className="flex items-center gap-2 text-xl font-semibold">
                    <Wrench size={20} className="text-sky-600" /> Maintenance by type
                  </h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {Object.entries(intelligence.maintenance.byType).map(([type, count]) => (
                      <span key={type} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {type}: <span className="font-bold">{count}</span>
                      </span>
                    ))}
                    {Object.keys(intelligence.maintenance.byType).length === 0 && <p className="text-sm text-slate-500">No open maintenance alerts.</p>}
                  </div>
                  <div className="mt-4 space-y-2">
                    {intelligence.maintenance.highRisk.slice(0, 4).map((alert) => (
                      <div key={alert._id} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
                        <p className="font-semibold">{alert.busNumber} · {alert.alertType} · due in {alert.predictedDaysUntilFailure} day(s)</p>
                        <p className="mt-0.5 text-xs">{alert.message}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <h2 className="flex items-center gap-2 text-xl font-semibold">
                    <Siren size={20} className="text-rose-500" /> Accident history
                  </h2>
                  <div className="mt-4 space-y-2">
                    {intelligence.accidents.recent.length === 0 && <EmptyState title="No accidents recorded" message="Accident history appears here after automatic detection or manual SOS." />}
                    {intelligence.accidents.recent.map((accident) => (
                      <div key={accident.alertId} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                        <div className="flex items-center gap-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${accident.trigger === 'automatic' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'}`}>
                            {accident.trigger}
                          </span>
                          <p className="font-semibold text-slate-900 dark:text-white">{accident.busNumber || 'Unknown bus'}</p>
                          {accident.impact?.magnitude ? <span className="text-xs text-slate-500">{accident.impact.magnitude} m/s²</span> : null}
                        </div>
                        <span className="text-xs text-slate-400">{formatDate(accident.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  )
}

export default AnalyticsPage
