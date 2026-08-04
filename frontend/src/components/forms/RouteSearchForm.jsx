import { useState } from 'react'
import { MapPinned, Search } from 'lucide-react'

const RouteSearchForm = ({ onSubmit, loading }) => {
  const [form, setForm] = useState({ source: 'Kopargaon', destination: 'Shirdi' })

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
        <MapPinned size={18} className="text-sky-700" />
        <p className="font-semibold">Plan a journey</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          required
          value={form.source}
          onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))}
          placeholder="Source"
          className="rounded-2xl border border-slate-300 px-3 py-3 outline-none dark:border-slate-700 dark:bg-slate-950"
        />
        <input
          required
          value={form.destination}
          onChange={(event) => setForm((current) => ({ ...current, destination: event.target.value }))}
          placeholder="Destination"
          className="rounded-2xl border border-slate-300 px-3 py-3 outline-none dark:border-slate-700 dark:bg-slate-950"
        />
      </div>
      <button type="submit" disabled={loading} className="mt-4 flex items-center gap-2 rounded-2xl bg-sky-700 px-4 py-3 font-semibold text-white disabled:opacity-70">
        <Search size={16} />
        {loading ? 'Planning...' : 'Show routes'}
      </button>
    </form>
  )
}

export default RouteSearchForm
