const ErrorState = ({ title = 'We hit a snag', message = 'Please try again shortly.' }) => (
  <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
    <p className="font-semibold">{title}</p>
    <p className="mt-1">{message}</p>
  </div>
)

export default ErrorState
