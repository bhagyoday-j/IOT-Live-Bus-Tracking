import { MapContainer, TileLayer } from 'react-leaflet'
import BusMarker from './BusMarker'

const LiveMap = ({ buses = [] }) => {
  return (
    <div className="h-[420px] overflow-hidden rounded-3xl border border-slate-200 shadow-sm dark:border-slate-700">
      <MapContainer center={[19.9975, 73.7898]} zoom={12} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {buses.map((bus) => (
          <BusMarker key={bus.busId || bus._id} bus={bus} />
        ))}
      </MapContainer>
    </div>
  )
}

export default LiveMap
