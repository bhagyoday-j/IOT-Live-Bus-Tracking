import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import AnalyticsCard from '../../components/cards/AnalyticsCard'
import Loader from '../../components/common/Loader'
import ErrorState from '../../components/common/ErrorState'
import EmptyState from '../../components/common/EmptyState'
import { getFleetHealth, getBusHealth, getTelemetryHistory, simulateAccident } from '../../services/healthService'
import { MANAGER_NAV } from '../../utils/constants'
import { useSocket } from '../../hooks/useSocket'
import { formatDate } from '../../utils/helpers'
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, Tooltip, XAxis, YAxis, Legend,
} from 'recharts'
import {
  Activity, BatteryCharging, Gauge, HeartPulse, Siren, Thermometer, Zap,
} from 'lucide-react'

const HEALTH_TONE = {
  healthy: { label: 'Healthy', chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300', dot: 'bg-emerald-500' },
  warning: { label: 'Warning', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300', dot: 'bg-amber-500' },
  critical: { label: 'Critical', chip: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300', dot: 'bg-rose-500' },
  unknown: { label: 'Unknown', chip: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', dot: 'bg-slate-400' },
}

const recomputeSummary = (buses) =>
  buses.reduce((acc, bus) => {
    const key = HEALTH_TONE[bus.healthStatus] ? bus.healthStatus : 'unknown'
    acc[key] += 1
    return acc
  }, { healthy: 0, warning: 0, critical: 0, unknown: 0 })

const BusHealth = () => {
  const queryClient = useQueryClient()
  const { socket } = useSocket()
  const [selectedId, setSelectedId] = useState(null)
  const [simulating, setSimulating] = useState(false)

  const { data: fleet, isLoading, isError } = useQuery({
    queryKey: ['fleet-health'],
    queryFn: getFleetHealth,
    refetchInterval: 15000,
  })

  const { data: detail } = useQuery({
    queryKey: ['bus-health', selectedId],
    queryFn: () => getBusHealth(selectedId),
    enabled: !!selectedId,
    refetchInterval: 15000,
  })

  const { data: history } = useQuery({
    queryKey: ['telemetry-history', selectedId],
    queryFn: () => getTelemetryHistory(selectedId, 60),
    enabled: !!selectedId,
    refetchInterval: 30000,
  })

  // ── Live updates from the socket ─────────────────────────────────
  useEffect(() => {
    if (!socket) return

    const onTelemetry = (payload) => {
      queryClient.setQueryData(['fleet-health'], (old) => {
        if (!old) return old
        const buses = old.buses.map((b) =>
          b.busId === payload.busId ? {
            ...b,
            healthStatus: payload.status ?? b.healthStatus,
            engineTemperature: payload.engineTemperature ?? b.engineTemperature,
            batteryVoltage: payload.batteryVoltage ?? b.batteryVoltage,
            currentDraw: payload.currentDraw ?? b.currentDraw,
            vibration: payload.vibration ?? b.vibration,
            lastReadingAt: payload.timestamp,
          } : b,
        )
        return { ...old, buses, summary: recomputeSummary(buses) }
      })
      queryClient.invalidateQueries({ queryKey: ['bus-health', payload.busId] })
    }

    const onHealthChanged = (payload) => {
      queryClient.setQueryData(['fleet-health'], (old) => {
        if (!old) return old
        const buses = old.buses.map((b) => (b.busId === payload.busId ? { ...b, healthStatus: payload.status } : b))
        return { ...old, buses, summary: recomputeSummary(buses) }
      })
    }

    socket.on('busTelemetryUpdated', onTelemetry)
    socket.on('busHealthChanged', onHealthChanged)
    return () => {
      socket.off('busTelemetryUpdated', onTelemetry)
      socket.off('busHealthChanged', onHealthChanged)
    }
  }, [socket, queryClient])

  const selectedBus = useMemo(
    () => fleet?.buses?.find((b) => b.busId === selectedId) || null,
    [fleet, selectedId],
  )

  const chartData = useMemo(() => {
    const raw = history?.telemetry || []
    if (raw.length > 120) {
      const step = Math.ceil(raw.length / 120)
      return raw.filter((_, i) => i % step === 0).map(toChartPoint)
    }
    return raw.map(toChartPoint)
  }, [history])

  const handleSimulateAccident = async () => {
    if (!selectedId) return
    setSimulating(true)
    try {
      await simulateAccident(selectedId)
    } finally {
      setSimulating(false)
    }
  }

  return (
    <DashboardLayout navItems={MANAGER_NAV}>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-700 dark:text-sky-300">Bus health monitoring</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Live vehicle health</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Engine temperature, battery and electrical telemetry from in-bus IoT sensors, updated in real time.
          </p>
        </div>

        {isLoading ? <Loader /> : isError ? <ErrorState /> : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <AnalyticsCard title="Healthy buses" value={fleet.summary.healthy} subtitle="Within normal limits" tone="success" />
              <AnalyticsCard title="Warnings" value={fleet.summary.warning} subtitle="Elevated readings" tone="danger" />
              <AnalyticsCard title="Critical" value={fleet.summary.critical} subtitle="Immediate attention" tone="danger" />
              <AnalyticsCard title="Monitored" value={fleet.monitored} subtitle="Sensors reporting" />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Fleet health board</h2>
                <span className="text-xs font-medium uppercase tracking-widest text-slate-400">Select a bus for telemetry</span>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {fleet.buses.length === 0 && <EmptyState title="No buses" message="Seed the fleet to start monitoring vehicle health." />}
                {fleet.buses.map((bus) => {
                  const tone = HEALTH_TONE[bus.healthStatus] || HEALTH_TONE.unknown
                  const active = bus.busId === selectedId
                  return (
                    <button
                      key={bus.busId}
                      type="button"
                      onClick={() => setSelectedId(bus.busId)}
                      className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${active
                        ? 'border-sky-400 bg-sky-50 ring-2 ring-sky-200 dark:border-sky-500 dark:bg-sky-950/40 dark:ring-sky-900'
                        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                          <p className="font-semibold text-slate-900 dark:text-white">{bus.busNumber}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${tone.chip}`}>{tone.label}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{bus.route}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950">
                          <Thermometer size={14} className="mx-auto text-rose-500" />
                          <p className="mt-1 text-sm font-semibold">{bus.engineTemperature != null ? `${bus.engineTemperature.toFixed(1)}°C` : '—'}</p>
                          <p className="text-[10px] uppercase tracking-wider text-slate-400">Engine</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950">
                          <BatteryCharging size={14} className="mx-auto text-emerald-500" />
                          <p className="mt-1 text-sm font-semibold">{bus.batteryVoltage != null ? `${bus.batteryVoltage.toFixed(1)}V` : '—'}</p>
                          <p className="text-[10px] uppercase tracking-wider text-slate-400">Battery</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950">
                          <Zap size={14} className="mx-auto text-amber-500" />
                          <p className="mt-1 text-sm font-semibold">{bus.currentDraw != null ? `${bus.currentDraw.toFixed(0)}A` : '—'}</p>
                          <p className="text-[10px] uppercase tracking-wider text-slate-400">Load</p>
                        </div>
                      </div>
                      {bus.lastReadingAt && <p className="mt-3 text-[11px] text-slate-400">Last reading {formatDate(bus.lastReadingAt)}</p>}
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedId && (
              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">{selectedBus?.busNumber || 'Bus'} telemetry</h2>
                      <p className="text-sm text-slate-500">Last 60 minutes · engine temperature &amp; battery voltage</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSimulateAccident}
                      disabled={simulating}
                      className="flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                    >
                      <Siren size={16} />
                      {simulating ? 'Simulating…' : 'Simulate accident'}
                    </button>
                  </div>
                  <div className="mt-4 h-80">
                    {chartData.length > 1 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                          <YAxis yAxisId="temp" domain={[60, 120]} tick={{ fontSize: 11 }} />
                          <YAxis yAxisId="volt" orientation="right" domain={[10, 16]} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Line yAxisId="temp" type="monotone" dataKey="engineTemperature" name="Engine °C" stroke="#E11D48" strokeWidth={2} dot={false} />
                          <Line yAxisId="volt" type="monotone" dataKey="batteryVoltage" name="Battery V" stroke="#059669" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState title="Collecting telemetry" message="Sensor readings will appear here as the simulator feeds the bus." />
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <h2 className="flex items-center gap-2 text-xl font-semibold">
                      <HeartPulse size={20} className="text-rose-500" /> Current readings
                    </h2>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <ReadingTile icon={<Thermometer size={18} />} label="Engine temperature" value={selectedBus?.engineTemperature != null ? `${selectedBus.engineTemperature.toFixed(1)} °C` : '—'} />
                      <ReadingTile icon={<BatteryCharging size={18} />} label="Battery voltage" value={selectedBus?.batteryVoltage != null ? `${selectedBus.batteryVoltage.toFixed(2)} V` : '—'} />
                      <ReadingTile icon={<Zap size={18} />} label="Current draw" value={selectedBus?.currentDraw != null ? `${selectedBus.currentDraw.toFixed(1)} A` : '—'} />
                      <ReadingTile icon={<Activity size={18} />} label="Vibration" value={selectedBus?.vibration != null ? `${selectedBus.vibration.toFixed(2)} m/s²` : '—'} />
                    </div>
                    {detail?.openAlerts?.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-semibold text-slate-500">Open maintenance alerts</p>
                        {detail.openAlerts.map((alert) => (
                          <div key={alert._id} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
                            <p className="font-semibold uppercase tracking-wider">{alert.alertType}</p>
                            <p className="mt-0.5">{alert.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <h2 className="flex items-center gap-2 text-xl font-semibold">
                      <Gauge size={20} className="text-sky-600" /> Recent safety events
                    </h2>
                    <div className="mt-4 space-y-2">
                      {detail?.recentEvents?.length ? detail.recentEvents.map((event) => (
                        <EventRow key={event._id} event={event} />
                      )) : <p className="text-sm text-slate-500">No unsafe driving events recorded for this bus.</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

const toChartPoint = (item) => ({
  time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  engineTemperature: item.engineTemperature,
  batteryVoltage: item.batteryVoltage,
})

const ReadingTile = ({ icon, label, value }) => (
  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
    <div className="flex items-center gap-2 text-slate-500">{icon}<p className="text-xs font-medium uppercase tracking-wider">{label}</p></div>
    <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{value}</p>
  </div>
)

const EVENT_META = {
  harsh_braking: { label: 'Harsh braking', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
  sudden_acceleration: { label: 'Sudden acceleration', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
  sharp_turn: { label: 'Sharp turn', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300' },
  excessive_vibration: { label: 'Excessive vibration', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' },
  impact: { label: 'Impact', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' },
}

const EventRow = ({ event }) => {
  const meta = EVENT_META[event.type] || EVENT_META.excessive_vibration
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3 text-sm dark:border-slate-700">
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${meta.cls}`}>{meta.label}</span>
        <span className="text-slate-500">{event.speed} km/h</span>
      </div>
      <span className="text-xs text-slate-400">{formatDate(event.timestamp)}</span>
    </div>
  )
}

export default BusHealth
