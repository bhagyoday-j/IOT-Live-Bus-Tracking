import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import AnalyticsCard from '../../components/cards/AnalyticsCard'
import Loader from '../../components/common/Loader'
import ErrorState from '../../components/common/ErrorState'
import EmptyState from '../../components/common/EmptyState'
import { getMaintenanceAlerts, resolveMaintenanceAlert, runMaintenanceAnalysis, getFleetIntelligence } from '../../services/healthService'
import { MANAGER_NAV } from '../../utils/constants'
import { useSocket } from '../../hooks/useSocket'
import { formatDate } from '../../utils/helpers'
import { CheckCircle2, Wrench, CalendarClock, RefreshCw, AlertTriangle } from 'lucide-react'

const TYPE_META = {
  overheating: { label: 'Overheating', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
  battery: { label: 'Battery', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
  electrical: { label: 'Electrical', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300' },
  vibration: { label: 'Vibration', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' },
  general: { label: 'General', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
}

const SEVERITY_BORDER = {
  critical: 'border-rose-300 dark:border-rose-900/50',
  warning: 'border-amber-300 dark:border-amber-900/50',
  info: 'border-slate-300 dark:border-slate-700',
}

const Maintenance = () => {
  const queryClient = useQueryClient()
  const { socket } = useSocket()
  const [analyzing, setAnalyzing] = useState(false)

  const { data: alerts = [], isLoading, isError } = useQuery({
    queryKey: ['maintenance-alerts'],
    queryFn: () => getMaintenanceAlerts({ limit: 100 }),
    refetchInterval: 30000,
  })

  const { data: intel } = useQuery({
    queryKey: ['fleet-intelligence'],
    queryFn: getFleetIntelligence,
    refetchInterval: 60000,
  })

  const maintenance = intel?.intelligence?.maintenance || {}

  useEffect(() => {
    if (!socket) return
    const onAlert = () => queryClient.invalidateQueries({ queryKey: ['maintenance-alerts'] })
    socket.on('maintenanceAlertCreated', onAlert)
    return () => socket.off('maintenanceAlertCreated', onAlert)
  }, [socket, queryClient])

  const resolveMutation = useMutation({
    mutationFn: (id) => resolveMaintenanceAlert(id, 'Maintenance completed'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maintenance-alerts'] }),
  })

  const handleRunAnalysis = async () => {
    setAnalyzing(true)
    try {
      await runMaintenanceAnalysis()
      queryClient.invalidateQueries({ queryKey: ['maintenance-alerts'] })
    } finally {
      setAnalyzing(false)
    }
  }

  const openAlerts = alerts.filter((a) => a.status === 'open' || a.status === 'scheduled')
  const highRisk = openAlerts.filter((a) => a.predictedDaysUntilFailure != null && a.predictedDaysUntilFailure <= 5)

  return (
    <DashboardLayout navItems={MANAGER_NAV}>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-700 dark:text-sky-300">Predictive maintenance</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Failure prediction</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Temperature, battery and vibration trends flag vehicles that may require maintenance before they break down.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={analyzing}
              className="flex items-center gap-2 rounded-2xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-50"
            >
              <RefreshCw size={16} className={analyzing ? 'animate-spin' : ''} />
              Run analysis now
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <AnalyticsCard title="Open alerts" value={openAlerts.length} subtitle="Awaiting action" tone="danger" />
          <AnalyticsCard title="High risk" value={highRisk.length} subtitle="Due within 5 days" tone="danger" />
          <AnalyticsCard title="Resolved" value={maintenance.resolved || 0} subtitle="Maintenance completed" tone="success" />
          <AnalyticsCard title="Scheduled" value={maintenance.scheduled || 0} subtitle="Work order queued" />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Wrench size={20} className="text-sky-600" /> Maintenance alerts
            </h2>
            <span className="text-xs font-medium uppercase tracking-widest text-slate-400">{alerts.length} total</span>
          </div>

          {isLoading ? <Loader label="Loading maintenance alerts..." /> : isError ? <ErrorState /> : (
            <div className="mt-5 space-y-3">
              {alerts.length === 0 && <EmptyState title="No maintenance alerts" message="Predictive analysis hasn't flagged any vehicles yet. Run an analysis or let the telemetry simulator feed trends." />}
              {alerts.map((alert) => {
                const meta = TYPE_META[alert.alertType] || TYPE_META.general
                const resolved = alert.status === 'resolved'
                return (
                  <div key={alert._id} className={`rounded-2xl border p-4 ${resolved ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20' : `bg-white ${SEVERITY_BORDER[alert.severity] || SEVERITY_BORDER.info} dark:bg-slate-900`}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${meta.cls}`}>{meta.label}</span>
                        <p className="font-semibold text-slate-900 dark:text-white">{alert.busNumber}</p>
                        {alert.predictedDaysUntilFailure != null && !resolved && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-rose-600">
                            <CalendarClock size={14} /> due in {alert.predictedDaysUntilFailure} day(s)
                          </span>
                        )}
                      </div>
                      {!resolved && (
                        <button
                          type="button"
                          onClick={() => resolveMutation.mutate(alert._id)}
                          disabled={resolveMutation.isPending}
                          className="flex items-center gap-1.5 rounded-2xl border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                        >
                          <CheckCircle2 size={14} /> Mark resolved
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{alert.message}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>Severity: {alert.severity}</span>
                      <span>·</span>
                      <span>Detected {formatDate(alert.detectedAt)}</span>
                      {alert.evidence?.trendSlope ? <><span>·</span><span>Trend {alert.evidence.trendSlope.toFixed(2)}/hr</span></> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {highRisk.length > 0 && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 dark:border-rose-900/40 dark:bg-rose-950/30">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-rose-800 dark:text-rose-200">
              <AlertTriangle size={20} /> Immediate maintenance window
            </h2>
            <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">These vehicles are predicted to fail within 5 days — schedule them into the workshop first.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default Maintenance
