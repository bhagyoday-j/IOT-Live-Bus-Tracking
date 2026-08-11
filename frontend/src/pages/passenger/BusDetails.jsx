import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import Loader from '../../components/common/Loader'
import ErrorState from '../../components/common/ErrorState'
import EmptyState from '../../components/common/EmptyState'
import { getBusById, getBusETA } from '../../services/busService'
import { PASSENGER_NAV } from '../../utils/constants'
import { Thermometer, BatteryCharging, Zap, HeartPulse } from 'lucide-react'

const HEALTH_CHIP = {
  healthy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  critical: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  unknown: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

const BusDetails = () => {
  const { id } = useParams()
  const { data: bus, isLoading, isError } = useQuery({ queryKey: ['bus', id], queryFn: () => getBusById(id) })
  const { data: etaData } = useQuery({ queryKey: ['bus-eta', id], queryFn: () => getBusETA(id), enabled: !!id, refetchInterval: 30000 })

  const eta = etaData?.eta
  const health = bus?.health

  return (
    <DashboardLayout navItems={PASSENGER_NAV}>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-700 dark:text-sky-300">Bus details</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{bus?.busNumber || 'Bus information'}</h1>
        </div>

        {isLoading ? <Loader /> : isError ? <ErrorState /> : (
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Operational overview</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${HEALTH_CHIP[health?.status] || HEALTH_CHIP.unknown}`}>
                    {health?.status || 'unknown'} health
                  </span>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><p className="text-sm text-slate-500">Route</p><p className="mt-1 text-lg font-semibold">{bus.route}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><p className="text-sm text-slate-500">Driver</p><p className="mt-1 text-lg font-semibold">{bus.driver}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><p className="text-sm text-slate-500">Current speed</p><p className="mt-1 text-lg font-semibold">{bus.currentSpeed} km/h</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><p className="text-sm text-slate-500">Status</p><p className="mt-1 text-lg font-semibold capitalize">{bus.status}</p></div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <HeartPulse size={20} className="text-rose-500" /> Bus health monitoring
                </h2>
                <p className="mt-1 text-sm text-slate-500">Live sensor readings from the in-bus IoT device</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <HealthTile icon={<Thermometer size={18} />} label="Engine temperature" value={health?.engineTemperature != null ? `${health.engineTemperature.toFixed(1)} °C` : '—'} />
                  <HealthTile icon={<BatteryCharging size={18} />} label="Battery voltage" value={health?.batteryVoltage != null ? `${health.batteryVoltage.toFixed(2)} V` : '—'} />
                  <HealthTile icon={<Zap size={18} />} label="Electrical load" value={health?.currentDraw != null ? `${health.currentDraw.toFixed(1)} A` : '—'} />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-xl font-semibold">Upcoming stops &amp; ETA</h2>
              {eta?.stops?.length ? (
                <div className="mt-4 space-y-3">
                  {eta.stops.map((stop, index) => (
                    <div key={stop.stopId || `stop-${index}`} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                      <div className="flex items-center gap-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-sky-600" />
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{stop.stopName || `Stop ${index + 1}`}</p>
                          <p className="text-xs text-slate-500">{stop.order != null ? `Stop #${stop.order + 1}` : ''}{stop.distance ? ` · ${stop.distance} km away` : ''}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                        {stop.etaMinutes != null ? `${stop.etaMinutes} min` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No ETA available" message="Arrival predictions will appear once the bus is assigned to a route." />
              )}
              {eta?.nextStop && <p className="mt-4 text-sm text-slate-500">Next stop: <span className="font-semibold text-slate-800 dark:text-slate-100">{eta.nextStop}</span> · {eta.etaMinutes != null ? `${eta.etaMinutes} minutes` : '—'}</p>}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

const HealthTile = ({ icon, label, value }) => (
  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
    <div className="flex items-center gap-2 text-slate-500">{icon}<p className="text-xs font-medium uppercase tracking-wider">{label}</p></div>
    <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{value}</p>
  </div>
)

export default BusDetails
