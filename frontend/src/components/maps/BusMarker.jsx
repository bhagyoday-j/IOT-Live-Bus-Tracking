import { divIcon } from 'leaflet'
import { Marker, Popup } from 'react-leaflet'

const HEALTH_COLORS = {
  healthy: '#10B981',
  warning: '#F59E0B',
  critical: '#EF4444',
  unknown: '#94A3B8',
}

const getIcon = (healthStatus) => {
  const color = HEALTH_COLORS[healthStatus] || HEALTH_COLORS.unknown
  return divIcon({
    html: `<div style="background:${color};border-radius:999px;width:16px;height:16px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
    className: '',
    iconSize: [16, 16],
  })
}

const BusMarker = ({ bus }) => (
  <Marker position={[bus.lat, bus.lng]} icon={getIcon(bus.healthStatus)}>
    <Popup>
      <div className="space-y-1 text-sm">
        <p className="font-semibold">{bus.busNumber}</p>
        <p>Route: {bus.routeName || bus.route || 'Live route'}</p>
        <p>Speed: {bus.speed ?? '—'} km/h</p>
        <p>ETA: {bus.etaMinutes ?? '—'} mins</p>
        <p>Status: {bus.status}</p>
        <p className="capitalize">Health: {bus.healthStatus || 'unknown'}</p>
      </div>
    </Popup>
  </Marker>
)

export default BusMarker
