export const APP_NAME = 'SMARTTRANSIT'
export const APP_TAGLINE = 'Intelligent Public Transportation Management System'

export const COLORS = {
  primary: '#0F4C81',
  secondary: '#2E86DE',
  success: '#27AE60',
  danger: '#E74C3C',
}

export const ROLE_HOME = {
  PASSENGER: '/',
  MANAGER: '/manager',
  ADMIN: '/admin',
}

export const PASSENGER_NAV = [
  { label: 'Home', path: '/' },
  { label: 'Live Tracking', path: '/track' },
  { label: 'Route Planner', path: '/routes' },
  { label: 'Notifications', path: '/notifications' },
  { label: 'Profile', path: '/profile' },
]

export const MANAGER_NAV = [
  { label: 'Overview', path: '/manager' },
  { label: 'Fleet Tracking', path: '/manager/fleet' },
  { label: 'Analytics', path: '/manager/analytics' },
  { label: 'Trips', path: '/manager/trips' },
]

export const ADMIN_NAV = [
  { label: 'Overview', path: '/admin' },
  { label: 'Buses', path: '/admin/buses' },
  { label: 'Routes', path: '/admin/routes' },
  { label: 'Drivers', path: '/admin/drivers' },
  { label: 'Stops', path: '/admin/stops' },
  { label: 'Depots', path: '/admin/depots' },
  { label: 'Users', path: '/admin/users' },
]
