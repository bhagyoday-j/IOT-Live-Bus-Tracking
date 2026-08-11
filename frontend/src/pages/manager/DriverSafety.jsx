import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import AnalyticsCard from '../../components/cards/AnalyticsCard'
import Loader from '../../components/common/Loader'
import ErrorState from '../../components/common/ErrorState'
import EmptyState from '../../components/common/EmptyState'
import { getDriverSafety, getSafetyEvents, getSafetyReport } from '../../services/healthService'
import { MANAGER_NAV } from '../../utils/constants'
import { useSocket } from '../../hooks/useSocket'
import { formatDate } from '../../utils/helpers'
import { Shield, ShieldAlert, TrendingDown, TrendingUp, Minus } from 'lucide-react'

const EVENT_META = {
  harsh_braking: { label: 'Harsh braking', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
  sudden_acceleration: { label: 'Sudden acceleration', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
  sharp_turn: { label: 'Sharp turn', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300' },
  excessive_vibration: { label: 'Excessive vibration', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' },
  impact: { label: 'Impact', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' },
}

const scoreColor = (score) => {
  if (score >= 90) return 'text-emerald-600'
  if (score >= 75) return 'text-amber-600'
  return 'text-rose-600'
}

const scoreBarColor = (score) => {
  if (score >= 90) return 'bg-emerald-500'
  if (score >= 75) return 'bg-amber-500'
  return 'bg-rose-500'
}

const TrendBadge = ({ trend }) => {
  if (trend === 'improving') return <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><TrendingUp size={14} /> Improving</span>
  if (trend === 'declining') return <span className="flex items-center gap-1 text-xs font-semibold text-rose-600"><TrendingDown size={14} /> Declining</span>
  return <span className="flex items-center gap-1 text-xs font-semibold text-slate-500"><Minus size={14} /> Stable</span>
}

const DriverSafety = () => {
  const queryClient = useQueryClient()
  const { socket } = useSocket()
  const [eventLimit] = useState(40)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['driver-safety'],
    queryFn: getDriverSafety,
    refetchInterval: 30000,
  })

  const { data: eventsData } = useQuery({
    queryKey: ['safety-events', eventLimit],
    queryFn: () => getSafetyEvents({ limit: eventLimit }),
    refetchInterval: 30000,
  })

  const { data: report } = useQuery({
    queryKey: ['safety-report'],
    queryFn: getSafetyReport,
    refetchInterval: 60000,
  })

  // Live event feed
  useEffect(() => {
    if (!socket) return
    const onEvent = () => {
      queryClient.invalidateQueries({ queryKey: ['safety-events'] })
      queryClient.invalidateQueries({ queryKey: ['driver-safety'] })
    }
    socket.on('driverEventDetected', onEvent)
    socket.on('accidentDetected', onEvent)
    return () => {
      socket.off('driverEventDetected', onEvent)
      socket.off('accidentDetected', onEvent)
    }
  }, [socket, queryClient])

  const events = eventsData?.events || []
  const byType = report?.byType || {}
  const eventsToday = report?.eventsToday || 0
  const drivers = data?.drivers || []

  const worstDrivers = [...drivers].sort((a, b) => a.score - b.score).slice(0, 5)

  return (
    <DashboardLayout navItems={MANAGER_NAV}>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-700 dark:text-sky-300">Driver safety analysis</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Driving behaviour intelligence</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Unsafe events detected from MPU6050 motion data — harsh braking, sudden acceleration, sharp turns and vibration — feed each driver&apos;s safety score.
          </p>
        </div>

        {isLoading ? <Loader /> : isError ? <ErrorState /> : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 text-white shadow-sm">
                <div className="flex items-center gap-2"><Shield size={18} /><p className="text-sm font-medium opacity-90">Fleet safety average</p></div>
                <p className="mt-3 text-4xl font-semibold">{data.fleetAverage}<span className="text-lg font-medium opacity-80">/100</span></p>
              </div>
              <AnalyticsCard title="Events today" value={eventsToday} subtitle="Detected unsafe events" tone="danger" />
              <AnalyticsCard title="Harsh braking" value={byType.harsh_braking || 0} subtitle="Most common risk event" tone="danger" />
              <AnalyticsCard title="Accidents / impacts" value={byType.impact || 0} subtitle="Automatic detections" tone="danger" />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Driver safety scores</h2>
                  <span className="text-xs font-medium uppercase tracking-widest text-slate-400">{drivers.length} drivers</span>
                </div>
                <div className="mt-5 space-y-4">
                  {drivers.length === 0 && <EmptyState title="No scored drivers" message="Safety scores appear once driving events are recorded." />}
                  {drivers.map((driver) => (
                    <div key={driver.driverId} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{driver.name}</p>
                          <p className="text-xs text-slate-500">{driver.totalEvents} event(s) · {driver.status}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${scoreColor(driver.score)}`}>{driver.score}</p>
                          <TrendBadge trend={driver.trend} />
                        </div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className={`h-full rounded-full ${scoreBarColor(driver.score)} transition-all duration-500`} style={{ width: `${driver.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <ShieldAlert size={20} className="text-rose-500" /> Live event feed
                </h2>
                <p className="mt-1 text-sm text-slate-500">Latest unsafe driving events across the fleet</p>
                <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                  {events.length === 0 && <EmptyState title="No events yet" message="Driving events will stream in from the telemetry simulator." />}
                  {events.map((event) => {
                    const meta = EVENT_META[event.type] || EVENT_META.excessive_vibration
                    return (
                      <div key={event.eventId} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${meta.cls}`}>{meta.label}</span>
                          <span className="text-xs text-slate-400">{formatDate(event.timestamp)}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                          Bus <span className="font-semibold">{event.busNumber || '—'}</span>
                          {event.driverName ? <> · <span className="font-semibold">{event.driverName}</span></> : null}
                          <span className="text-slate-500"> · magnitude {event.magnitude}</span>
                          {event.speed ? <span className="text-slate-500"> · {event.speed} km/h</span> : null}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {worstDrivers.length > 0 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h2 className="text-xl font-semibold">Drivers needing attention</h2>
                <p className="mt-1 text-sm text-slate-500">Lowest safety scores — coaching recommended</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {worstDrivers.map((driver) => (
                    <div key={driver.driverId} className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/40">
                      <p className="font-semibold text-slate-900 dark:text-white">{driver.name}</p>
                      <p className={`mt-1 text-2xl font-bold ${scoreColor(driver.score)}`}>{driver.score}</p>
                      <p className="text-xs text-slate-500">{driver.totalEvents} event(s)</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

export default DriverSafety
