import { divIcon } from 'leaflet'
import { Marker, Popup } from 'react-leaflet'

const icon = divIcon({
  html: '<div style="background:#0F4C81;border-radius:999px;width:16px;height:16px;border:2px solid white"></div>',
  className: '',
  iconSize: [16, 16],
})

const BusMarker = ({ bus }) => (
  <Marker position={[bus.lat, bus.lng]} icon={icon}>
    <Popup>
      <div className="space-y-1 text-sm">
        <p className="font-semibold">{bus.busNumber}</p>
        <p>Route: {bus.routeName || bus.route || 'Live route'}</p>
        <p>Speed: {bus.speed ?? '—'} km/h</p>
        <p>ETA: {bus.etaMinutes ?? '—'} mins</p>
        <p>Status: {bus.status}</p>
      </div>
    </Popup>
  </Marker>
)

export default BusMarker
