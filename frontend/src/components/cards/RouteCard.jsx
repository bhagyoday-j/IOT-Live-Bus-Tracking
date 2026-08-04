const RouteCard = ({ route }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
    <p className="text-lg font-semibold text-slate-900 dark:text-white">{route.name || route.routeName}</p>
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{route.description || 'Connected service corridor'}</p>
  </div>
)

export default RouteCard
