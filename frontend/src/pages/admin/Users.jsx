import DashboardLayout from '../../components/layouts/DashboardLayout'
import { ADMIN_NAV } from '../../utils/constants'

const Users = () => (
  <DashboardLayout navItems={ADMIN_NAV}>
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-700 dark:text-sky-300">Users</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">User administration</h1>
          </div>
          <button type="button" className="rounded-2xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white">Invite user</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-200 dark:border-slate-700">
              <td className="px-4 py-3">John</td>
              <td className="px-4 py-3">john@test.com</td>
              <td className="px-4 py-3">Passenger</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </DashboardLayout>
)

export default Users
