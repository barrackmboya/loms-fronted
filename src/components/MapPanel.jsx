// MapPanel.jsx — reusable Leaflet map panel.
// Interactive OpenStreetMap map with a single optional marker. Marker icon
// URLs are patched so they resolve correctly under the Vite bundler.
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Fix the default Leaflet marker icon for bundlers.
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

export function MapPanel({ center = [-1.2833, 36.8180], zoom = 15, label }) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{
        height: '450px',
        maxHeight: '470px',
        width: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid var(--line)',
      }}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {label ? (
        <Marker position={center}>
          <Tooltip>{label}</Tooltip>
        </Marker>
      ) : (
        <Marker position={center} />
      )}
    </MapContainer>
  )
}
