import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import AnalyticsCard from '../../components/cards/AnalyticsCard'
import BusCard from '../../components/cards/BusCard'
import RouteCard from '../../components/cards/RouteCard'
import RouteSearchForm from '../../components/forms/RouteSearchForm'
import Loader from '../../components/common/Loader'
import ErrorState from '../../components/common/ErrorState'
import { getBuses, getLiveTracking } from '../../services/busService'
import { planRoute } from '../../services/routeService'
import { PASSENGER_NAV } from '../../utils/constants'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'

const Home = () => {
  const { user } = useAuth()
  const { events } = useSocket()

  const { data: buses = [], isLoading: busesLoading, isError: busesError } = useQuery({ queryKey: ['buses'], queryFn: getBuses })
  const { data: tracking = [], isLoading: trackingLoading, isError: trackingError } = useQuery({ queryKey: ['tracking'], queryFn: getLiveTracking })

  const popularRoutes = useMemo(() => [
    { name: 'Route A', description: 'North corridor access' },
    { name: 'Route B', description: 'Airport connector' },
    { name: 'Route C', description: 'City loop' },
  ], [])

  const recentSearches = useMemo(() => ['Kopargaon → Shirdi', 'Nashik → Mumbai', 'Pune → Solapur'], [])

  return (
    <DashboardLayout navItems={PASSENGER_NAV}>
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-700 via-sky-800 to-slate-900 p-8 text-white shadow-lg">
          <p className="text-sm uppercase tracking-[0.32em] text-sky-100">Passenger portal</p>
          <h1 className="mt-3 text-3xl font-semibold">Welcome back, {user?.name || 'traveller'}</h1>
          <p className="mt-3 max-w-2xl text-sm text-sky-100">Search routes, track buses live, and stay ahead of service updates with a government-grade transit experience.</p>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <RouteSearchForm onSubmit={async (values) => { await planRoute(values) }} loading={false} />
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold">Live activity</h2>
            <div className="mt-4 space-y-3">
              {events.length ? events.map((event) => (
                <div key={`${event.eventName}-${event.timestamp}`} className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  <p className="font-semibold">{event.eventName}</p>
                  <p>{JSON.stringify(event.payload)}</p>
                </div>
              )) : <p className="text-sm text-slate-500">Socket events will appear here once the backend emits them.</p>}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <AnalyticsCard title="Popular routes" value={popularRoutes.length} subtitle="High demand corridors" />
          <AnalyticsCard title="Nearby buses" value={tracking.length} subtitle="Live units on the map" />
          <AnalyticsCard title="Live alerts" value={events.length} subtitle="Realtime service updates" tone="success" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Nearby buses</h2>
              <span className="text-sm text-slate-500">Updated live</span>
            </div>
            {busesLoading || trackingLoading ? <Loader /> : busesError || trackingError ? <ErrorState /> : (
              <div className="grid gap-4 md:grid-cols-2">
                {buses.slice(0, 4).map((bus) => <BusCard key={bus._id} bus={bus} />)}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Popular routes</h2>
            <div className="space-y-3">
              {popularRoutes.map((route) => <RouteCard key={route.name} route={route} />)}
            </div>
            <h2 className="mt-6 text-xl font-semibold">Recent searches</h2>
            <div className="space-y-3">
              {recentSearches.map((item) => <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{item}</div>)}
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}

export default Home
