import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import RouteSearchForm from '../../components/forms/RouteSearchForm'
import ErrorState from '../../components/common/ErrorState'
import { planRoute } from '../../services/routeService'
import { PASSENGER_NAV } from '../../utils/constants'
import { formatCurrency } from '../../utils/helpers'

const RoutePlanner = () => {
  const [result, setResult] = useState(null)
  const mutation = useMutation({ mutationFn: planRoute, onSuccess: (data) => setResult(data) })

  return (
    <DashboardLayout navItems={PASSENGER_NAV}>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-700 dark:text-sky-300">Route planner</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Plan a route</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Find the best transit option between two locations with fare and ETA details.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <RouteSearchForm onSubmit={(values) => mutation.mutate(values)} loading={mutation.isPending} />
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            {mutation.isError ? <ErrorState /> : result ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                    <p className="text-sm text-slate-500">Estimated time</p>
                    <p className="mt-2 text-xl font-semibold">{result.estimatedTime}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                    <p className="text-sm text-slate-500">Fare</p>
                    <p className="mt-2 text-xl font-semibold">{formatCurrency(result.totalFare)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                    <p className="text-sm text-slate-500">Interchanges</p>
                    <p className="mt-2 text-xl font-semibold">{result.interchanges}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                  <h2 className="text-lg font-semibold">Matching buses</h2>
                  <div className="mt-3 space-y-2">
                    {result.buses?.length ? result.buses.map((bus) => <div key={bus._id || bus.busId} className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-950">{bus.busNumber || bus.routeName || bus.name}</div>) : <p className="text-sm text-slate-500">No buses returned by the backend for this route plan.</p>}
                  </div>
                </div>
              </div>
            ) : <p className="text-sm text-slate-500">Submit a route search to see live trip guidance.</p>}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default RoutePlanner
