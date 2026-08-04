import DashboardLayout from '../../components/layouts/DashboardLayout'
import { ADMIN_NAV } from '../../utils/constants'
import { useQuery } from '@tanstack/react-query'
import { getBuses } from '../../services/busService'
import Loader from '../../components/common/Loader'
import ErrorState from '../../components/common/ErrorState'

const Buses = () => {
  const { data = [], isLoading, isError } = useQuery({ queryKey: ['admin-buses'], queryFn: getBuses })

  return (
    <DashboardLayout navItems={ADMIN_NAV}>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-700 dark:text-sky-300">Buses</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Fleet catalogue</h1>
            </div>
            <button type="button" className="rounded-2xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white">Add bus</button>
          </div>
        </div>

        {isLoading ? <Loader /> : isError ? <ErrorState /> : (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Bus number</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item._id} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-4 py-3">{item.busNumber}</td>
                    <td className="px-4 py-3">{item.routeName || item.route}</td>
                    <td className="px-4 py-3">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default Buses
