import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Login from '../pages/auth/Login'
import Home from '../pages/passenger/Home'
import LiveTracking from '../pages/passenger/LiveTracking'
import RoutePlanner from '../pages/passenger/RoutePlanner'
import BusDetails from '../pages/passenger/BusDetails'
import Notifications from '../pages/passenger/Notifications'
import Profile from '../pages/passenger/Profile'
import ManagerDashboard from '../pages/manager/Dashboard'
import FleetTracking from '../pages/manager/FleetTracking'
import Analytics from '../pages/manager/Analytics'
import Trips from '../pages/manager/Trips'
import AdminDashboard from '../pages/admin/Dashboard'
import Buses from '../pages/admin/Buses'
import AdminRoutes from '../pages/admin/Routes'
import Drivers from '../pages/admin/Drivers'
import Stops from '../pages/admin/Stops'
import Depots from '../pages/admin/Depots'
import Users from '../pages/admin/Users'
import ProtectedRoute from './ProtectedRoute'

const AppRoutes = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute allowedRoles={['PASSENGER']} />}>
        <Route path="/" element={<Home />} />
        <Route path="/track" element={<LiveTracking />} />
        <Route path="/routes" element={<RoutePlanner />} />
        <Route path="/bus/:id" element={<BusDetails />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['MANAGER']} />}>
        <Route path="/manager" element={<ManagerDashboard />} />
        <Route path="/manager/fleet" element={<FleetTracking />} />
        <Route path="/manager/analytics" element={<Analytics />} />
        <Route path="/manager/trips" element={<Trips />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/buses" element={<Buses />} />
        <Route path="/admin/routes" element={<AdminRoutes />} />
        <Route path="/admin/drivers" element={<Drivers />} />
        <Route path="/admin/stops" element={<Stops />} />
        <Route path="/admin/depots" element={<Depots />} />
        <Route path="/admin/users" element={<Users />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
)

export default AppRoutes
