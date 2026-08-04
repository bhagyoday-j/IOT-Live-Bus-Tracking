import DashboardLayout from '../../components/layouts/DashboardLayout'
import { MANAGER_NAV } from '../../utils/constants'

const Trips = () => (
  <DashboardLayout navItems={MANAGER_NAV}>
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-700 dark:text-sky-300">Trips</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Trip status board</h1>
      </div>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3">Route</th>
              <th className="px-4 py-3">Driver</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">ETA</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-200 dark:border-slate-700">
              <td className="px-4 py-3">Route A</td>
              <td className="px-4 py-3">Rahul</td>
              <td className="px-4 py-3">On time</td>
              <td className="px-4 py-3">6 min</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </DashboardLayout>
)

export default Trips
