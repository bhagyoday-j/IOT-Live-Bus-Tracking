const EmptyState = ({ title = 'Nothing to show', message = 'There are no records available right now.' }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
    <p className="font-semibold">{title}</p>
    <p className="mt-1">{message}</p>
  </div>
)

export default EmptyState
