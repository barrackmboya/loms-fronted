// MapPanel.jsx — reusable Leaflet map panel.
// Interactive OpenStreetMap map with teardrop pin markers, each carrying a
// permanent place-name label. Two usage modes:
//   1. Data-driven: pass `markers` (spatial dossier landmarks) and/or
//      `polyline` (street geometry) from the KYC report endpoint — every
//      landmark the user selected gets a pin + label, and the viewport
//      auto-fits to all of them.
//   2. Single point: pass `center` (+ optional `label`) with no markers.
// Marker icon URLs are patched so they resolve correctly under the Vite bundler.
import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Fix the default Leaflet marker icon for bundlers (still used by other maps).
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const DEFAULT_CENTER = [-1.2833, 36.8180]
const STREET_COLOR = '#176b63' // app teal (var(--teal))
const FALLBACK_PIN = '#176b63'

// Backend marker colors ("red" | "green" | "orange" | "purple") → hex.
const PIN_COLORS = {
  red: '#dc2626',
  green: '#16a34a',
  orange: '#ea580c',
  purple: '#7c3aed',
}

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))

// Teardrop pin (CSS) with the place name permanently labelled above it.
// iconAnchor is the pin tip, so the geo position sits at the point.
function pinIcon(label, color) {
  const hex = PIN_COLORS[color] ?? FALLBACK_PIN
  return L.divIcon({
    className: 'kyc-pin-icon', // replaces the default white-box icon styling
    iconSize: [42, 42],
    iconAnchor: [21, 42], // bottom tip of the teardrop
    html: `
      <div class="kyc-pin">
        <span class="kyc-pin-drop" style="--pin:${hex}"></span>
        ${label ? `<span class="kyc-pin-label">${escapeHtml(label)}</span>` : ''}
      </div>`,
  })
}

// MapContainer only reads `center` on construction — pan when the resolved
// center changes (e.g. report data arrives after the panel has mounted).
function Recenter({ center }) {
  const map = useMap()
  const lat = center?.[0]
  const lng = center?.[1]
  useEffect(() => {
    if (lat != null && lng != null) map.setView([lat, lng], map.getZoom())
  }, [lat, lng, map])
  return null
}

// Fit the viewport to all landmarks + street geometry once data is ready.
function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
  }, [bounds, map])
  return null
}

export function MapPanel({ center = DEFAULT_CENTER, zoom = 15, label, markers, polyline }) {
  const points = (markers ?? []).filter((m) => Array.isArray(m?.position))
  const hasStreet = Array.isArray(polyline?.coordinates) && polyline.coordinates.length > 1

  // Bounding box over every landmark pin + the street polyline, so all selected
  // landmarks are visible at once. Null → plain center/zoom mode.
  const bounds = useMemo(() => {
    const coords = [
      ...points.map((m) => m.position),
      ...(hasStreet ? polyline.coordinates.filter(Array.isArray) : []),
    ]
    return coords.length ? L.latLngBounds(coords) : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, polyline])

  return (
    <>
      {/* Teardrop pin + permanent label styles (global, like SlidePanel's). */}
      <style>{`
        .kyc-pin-icon { background: transparent; border: none; }
        .kyc-pin { position: relative; width: 42px; height: 42px; }
        .kyc-pin-drop {
          position: absolute;
          left: 6px;
          top: 6px;
          width: 30px;
          height: 30px;
          background: var(--pin, ${FALLBACK_PIN});
          border: 2px solid #fff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 6px rgba(13, 31, 28, 0.35);
        }
        /* Soft ground shadow under the pin tip. */
        .kyc-pin::after {
          content: '';
          position: absolute;
          left: 13px;
          bottom: -2px;
          width: 16px;
          height: 4px;
          border-radius: 50%;
          background: rgba(13, 31, 28, 0.25);
        }
        .kyc-pin-label {
          position: absolute;
          left: 21px;
          bottom: 44px;
          transform: translateX(-50%);
          white-space: nowrap;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid var(--line, #d3dad4);
          border-radius: 4px;
          padding: 1px 7px;
          font-size: 11px;
          font-weight: 600;
          line-height: 18px;
          color: #0d1f1c;
          box-shadow: 0 1px 3px rgba(13, 31, 28, 0.18);
          pointer-events: none;
        }
        .kyc-category-tooltip {
          background: #fef3c7 !important; /* amber-50 */
          border: 1px solid #f59e0b !important; /* amber-500 */
          border-radius: 4px;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 600;
          line-height: 18px;
          color: #92400e !important; /* amber-900 */
          box-shadow: 0 2px 6px rgba(13, 31, 28, 0.25);
        }
        .kyc-category-tooltip::before {
          border-top-color: #fef3c7 !important; /* match background for arrow */
        }
      `}</style>

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
          
        />
        {bounds ? <FitBounds bounds={bounds} /> : <Recenter center={center} />}

        {hasStreet && (
          <Polyline positions={polyline.coordinates} pathOptions={{ color: STREET_COLOR, weight: 4, opacity: 0.75 }}>
            {polyline.name ? <Tooltip sticky>{polyline.name}</Tooltip> : null}
          </Polyline>
        )}

        {points.length > 0
          ? points.map((m, i) => (
         
            
              <Marker key={m.id ?? i} position={m.position} icon={pinIcon(m.label, m.color)}>
                {m.category ? <Tooltip permanent className="kyc-category-tooltip">{m.category}</Tooltip> : null}
              </Marker>
            ))
          : (
            <Marker position={center} icon={pinIcon(label, FALLBACK_PIN)}>
              {label ? <Tooltip >{label}</Tooltip> : null}
            </Marker>
          )}
      </MapContainer>
    </>
  )
}
