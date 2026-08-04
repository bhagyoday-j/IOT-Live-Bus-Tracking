import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import Loader from '../../components/common/Loader'
import ErrorState from '../../components/common/ErrorState'
import { getBusById } from '../../services/busService'
import { PASSENGER_NAV } from '../../utils/constants'

const BusDetails = () => {
  const { id } = useParams()
  const { data, isLoading, isError } = useQuery({ queryKey: ['bus', id], queryFn: () => getBusById(id) })

  return (
    <DashboardLayout navItems={PASSENGER_NAV}>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-700 dark:text-sky-300">Bus details</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{data?.busNumber || 'Bus information'}</h1>
        </div>

        {isLoading ? <Loader /> : isError ? <ErrorState /> : (
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-xl font-semibold">Operational overview</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><p className="text-sm text-slate-500">Route</p><p className="mt-1 text-lg font-semibold">{data.route}</p></div>
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><p className="text-sm text-slate-500">Driver</p><p className="mt-1 text-lg font-semibold">{data.driver}</p></div>
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><p className="text-sm text-slate-500">Current speed</p><p className="mt-1 text-lg font-semibold">{data.currentSpeed} km/h</p></div>
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><p className="text-sm text-slate-500">Status</p><p className="mt-1 text-lg font-semibold">{data.status}</p></div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-xl font-semibold">Stops and ETA</h2>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">The backend contract includes current location and ETA details; the UI is ready to render them when the API returns stop-level data.</p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default BusDetails
