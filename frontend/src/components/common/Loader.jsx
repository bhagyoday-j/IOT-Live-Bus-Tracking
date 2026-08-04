const Loader = ({ label = 'Loading transit data...' }) => (
  <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
    <div className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-300">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-700" />
      {label}
    </div>
  </div>
)

export default Loader
