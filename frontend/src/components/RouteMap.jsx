/**
 * RouteMap — Leaflet-based route display with OSRM driving routes and Nominatim geocoding.
 * 100% free, no API key required. Replaces @react-google-maps/api.
 *
 * Props (same API as before):
 *   origin: string              — address/city
 *   destination: string         — address/city
 *   waypoints: string[]         — intermediate stops (reserved, not used in OSRM call yet)
 *   height: string              — CSS height (default "240px")
 *   liveMarkers: {id,name,lat,lng}[]  — passenger live pins
 *   driverMarker: {lat,lng,name}      — driver live pin
 *   onRouteCalculated(km)       — callback with total driving distance in km
 *   onOriginPicked(address)     — callback when user clicks map to set origin
 *   onDestinationPicked(address)— callback when user clicks map to set destination
 *   ref                         — exposes panTo(lat,lng), setOriginPin, setDestinationPin
 */
import {
  useState,
  useCallback,
  memo,
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
} from 'react'
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import toast from 'react-hot-toast'

// ─── Leaflet default marker icon fix ────────────────────────────────────────
// Bundlers break the default icon paths; re-bind them to unpkg CDN assets.
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ─── Constants ───────────────────────────────────────────────────────────────
const SL_CENTER = /** @type {[number, number]} */ ([7.8731, 80.7718])
const DEFAULT_ZOOM = 7
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

// ─── Custom DivIcon helpers ──────────────────────────────────────────────────
/** @param {'A'|'B'} label @param {string} color */
function createLabelIcon(label, color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${color};color:#fff;font-weight:bold;font-size:12px;
      display:flex;align-items:center;justify-content:center;
      border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"
    >${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function createDriverIcon(name) {
  return L.divIcon({
    className: '',
    html: `<div class="driver-pulse" style="
      width:44px;height:44px;border-radius:50%;
      background:#ea580c;color:#fff;font-weight:bold;font-size:11px;
      display:flex;align-items:center;justify-content:center;
      border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);
      position:relative;" title="${name || 'Driver'}">
      <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
      </svg>
    </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  })
}

/** @param {string} initial @param {string} name */
function createPassengerIcon(initial, name) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:40px;height:40px;border-radius:50%;
      background:#2563eb;color:#fff;font-weight:bold;font-size:14px;
      display:flex;align-items:center;justify-content:center;
      border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);"
      title="${name || 'Passenger'}">${initial}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

// ─── Geocoding helpers (Nominatim, no key required) ──────────────────────────
/**
 * Forward geocode: address string → { lat, lng } | null
 * @param {string} address
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
async function geocodeAddress(address) {
  if (!address?.trim()) return null
  try {
    const params = new URLSearchParams({
      q: address,
      countrycodes: 'lk',
      format: 'json',
      limit: '1',
    })
    const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'CommuteShareSL/1.0' },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

/**
 * Reverse geocode: { lat, lng } → address string
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{address: string, success: boolean}>}
 */
async function reverseGeocode(lat, lng) {
  const rawCoords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'json' })
    const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'CommuteShareSL/1.0' },
    })
    if (!res.ok) return { address: rawCoords, success: false }
    const data = await res.json()
    const address = data?.display_name || rawCoords
    return { address, success: !!data?.display_name }
  } catch {
    return { address: rawCoords, success: false }
  }
}

/**
 * OSRM driving route: { startLat, startLng, endLat, endLng }
 * → { polyline: [lat,lng][], distanceKm: number, durationMin: number } | null
 */
async function fetchOSRMRoute(startLat, startLng, endLat, endLng) {
  const url = `${OSRM_BASE}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`OSRM responded ${res.status}`)
    const data = await res.json()
    if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No route found')
    const route = data.routes[0]
    // GeoJSON coords are [lng, lat] — swap to Leaflet's [lat, lng]
    const polyline = route.geometry.coordinates.map(
      /** @param {[number,number]} c */ (c) => /** @type {[number,number]} */ ([c[1], c[0]])
    )
    const distanceKm = (route.distance / 1000).toFixed(1)
    const durationMin = Math.round(route.duration / 60)
    return { polyline, distanceKm: parseFloat(distanceKm), durationMin }
  } catch (err) {
    console.error('[OSRM] Route fetch failed:', err)
    return null
  }
}

// ─── Inner child components that need map context ─────────────────────────────

/** Exposes the Leaflet map instance via ref and handles click-to-pick */
function MapController({ mapRef, pickMode, onDepartureUpdate, onDestinationUpdate, setPickMode, setGeocoding, setOriginPin, setDestinationPin }) {
  const map = useMap()

  // Expose map instance to the parent ref
  useEffect(() => {
    mapRef.current = map
  }, [map, mapRef])

  useMapEvents({
    click: async (e) => {
      if (!pickMode) return
      const { lat, lng } = e.latlng
      setGeocoding(true)
      try {
        const result = await reverseGeocode(lat, lng)
        if (pickMode === 'origin') {
          setOriginPin({ lat, lng })
          onDepartureUpdate?.({ lat, lng, address: result.address })
          map.panTo([lat, lng])
          map.setZoom(14)
        } else {
          setDestinationPin({ lat, lng })
          onDestinationUpdate?.({ lat, lng, address: result.address })
          map.panTo([lat, lng])
          map.setZoom(14)
        }
        setPickMode(null)
        if (!result.success) toast.error('Could not get address. Using coordinates.')
      } catch {
        toast.error('An unexpected error occurred.')
      } finally {
        setGeocoding(false)
      }
    },
  })

  return null
}

// ─── Main RouteMap Component ──────────────────────────────────────────────────
const RouteMapInner = forwardRef(function RouteMapInner(
  {
    origin, // Can be string or { address, lat, lng }
    departure = { address: '', lat: null, lng: null },
    destination = { address: '', lat: null, lng: null },
    waypoints = [],
    height = '240px',
    liveMarkers = [],
    driverMarker = null,
    onRouteCalculated = null,
    onDepartureUpdate = null,
    onOriginPicked = null,
    onDestinationUpdate = null,
    onDestinationPicked = null,
  },
  ref
) {
  const [error, setError] = useState(/** @type {string|null} */ (null))
  const [isLoading, setIsLoading] = useState(false)
  const [pickMode, setPickMode] = useState(/** @type {'origin'|'destination'|null} */ (null))
  const [geocoding, setGeocoding] = useState(false)

  // Pin positions as { lat, lng }
  const [originPin, setOriginPin] = useState(/** @type {{lat:number,lng:number}|null} */ (null))
  const [destinationPin, setDestinationPin] = useState(/** @type {{lat:number,lng:number}|null} */ (null))

  // Route data from OSRM
  const [routeData, setRouteData] = useState(
    /** @type {{polyline:[number,number][],distanceKm:number,durationMin:number}|null} */ (null)
  )

  const mapRef = useRef(/** @type {import('leaflet').Map|null} */ (null))

  // Track previous origin/destination to avoid spurious re-fetches
  const prevOriginRef = useRef('')
  const prevDestinationRef = useRef('')

  // Expose imperative API to parent (same surface as the old Google Maps version)
  useImperativeHandle(ref, () => ({
    panTo: (lat, lng) => {
      if (mapRef.current) {
        mapRef.current.panTo([lat, lng])
        mapRef.current.setZoom(14)
      }
    },
    setOriginPin,
    setDestinationPin,
  }))

  const resetMap = () => {
    setOriginPin(null)
    setDestinationPin(null)
    setRouteData(null)
  }

  const isPickable = onDepartureUpdate || onDestinationUpdate || onOriginPicked || onDestinationPicked

  // Update Map Pins dynamically from the parent departure/origin/destination locations
  useEffect(() => {
    // If departure is provided as an object with lat/lng
    if (departure?.lat && departure?.lng) {
      setOriginPin({ lat: departure.lat, lng: departure.lng })
    } 
    // If origin is provided as an object with lat/lng
    else if (origin?.lat && origin?.lng) {
      setOriginPin({ lat: origin.lat, lng: origin.lng })
    }
    // If origin is provided as a string, we might need to geocode it (but for now we just handle objects or strings if already geocoded, though wait, SearchRide sets origin as a string)
    // Actually, if origin is a string and it's changed, we should geocode it.
    else if (typeof origin === 'string' && origin.trim().length > 0 && origin !== prevOriginRef.current) {
      prevOriginRef.current = origin;
      geocodeAddress(origin).then(coords => {
        if (coords) setOriginPin(coords);
      });
    } else if (!origin && !departure?.lat) {
      setOriginPin(null)
    }
  }, [departure, origin])

  useEffect(() => {
    if (destination?.lat && destination?.lng) {
      setDestinationPin({ lat: destination.lat, lng: destination.lng })
    } else if (typeof destination === 'string' && destination.trim().length > 0 && destination !== prevDestinationRef.current) {
      prevDestinationRef.current = destination;
      geocodeAddress(destination).then(coords => {
        if (coords) setDestinationPin(coords);
      });
    } else if (!destination && !destination?.lat) {
      setDestinationPin(null)
    }
  }, [destination])

  // Fetch OSRM route when both pins are set and distinct
  useEffect(() => {
    if (!originPin || !destinationPin) return
    if (originPin.lat === destinationPin.lat && originPin.lng === destinationPin.lng) return

    let canceled = false
    setIsLoading(true)
    setError(null)

    // Fit map to both pins
    if (mapRef.current) {
      mapRef.current.fitBounds(
        [
          [originPin.lat, originPin.lng],
          [destinationPin.lat, destinationPin.lng],
        ],
        { padding: [40, 40], maxZoom: 16 }
      )
    }

    fetchOSRMRoute(originPin.lat, originPin.lng, destinationPin.lat, destinationPin.lng)
      .then((route) => {
        if (canceled) return
        if (route) {
          setRouteData(route)
          onRouteCalculated?.(route.distanceKm)
        } else {
          setError('Route service unavailable.')
          toast.error('Map routing failed.')
          setRouteData(null)
        }
      })
      .catch((err) => {
        if (canceled) return
        console.error('[RouteMap] computeRoute error:', err)
        setError('Failed to compute route. Please try again.')
        toast.error('Map routing failed.')
        setRouteData(null)
      })
      .finally(() => {
        if (!canceled) setIsLoading(false)
      })

    return () => {
      canceled = true
    }
  }, [originPin, destinationPin, onRouteCalculated])

  return (
    <div
      className="animate-fade-in relative"
      style={{ height, width: '100%', borderRadius: '12px', overflow: 'hidden' }}
    >
      <MapContainer
        center={[7.8731, 80.7718]}
        zoom={8}
        minZoom={7}
        maxBounds={[[5.8, 79.5], [9.9, 82.0]]}
        style={{ width: '100%', height: '100%' }}
        zoomControl
        attributionControl={false}
        className={pickMode ? 'cursor-crosshair' : ''}
      >
        {/* OpenStreetMap tile layer — free, no key */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {/* Map controller — handles clicks and exposes map ref */}
        <MapController
          mapRef={mapRef}
          pickMode={pickMode}
          onDepartureUpdate={(loc) => {
            if (onDepartureUpdate) onDepartureUpdate(loc);
            if (onOriginPicked) onOriginPicked(loc.address);
          }}
          onDestinationUpdate={(loc) => {
            if (onDestinationUpdate) onDestinationUpdate(loc);
            if (onDestinationPicked) onDestinationPicked(loc.address);
          }}
          setPickMode={setPickMode}
          setGeocoding={setGeocoding}
          setOriginPin={setOriginPin}
          setDestinationPin={setDestinationPin}
        />

        {/* OSRM route polyline */}
        {routeData && (
          <Polyline
            positions={routeData.polyline}
            pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.85 }}
          />
        )}

        {/* Straight-line fallback when OSRM failed but pins exist */}
        {!routeData && !isLoading && originPin && destinationPin && (
          <Polyline
            positions={[
              [originPin.lat, originPin.lng],
              [destinationPin.lat, destinationPin.lng],
            ]}
            pathOptions={{ color: '#ea580c', weight: 3, opacity: 0.6, dashArray: '8 6' }}
          />
        )}

        {/* Origin marker — green A */}
        {originPin && (
          <Marker
            position={[originPin.lat, originPin.lng]}
            icon={createLabelIcon('A', '#16a34a')}
          />
        )}

        {/* Destination marker — red B */}
        {destinationPin && (
          <Marker
            position={[destinationPin.lat, destinationPin.lng]}
            icon={createLabelIcon('B', '#dc2626')}
          />
        )}

        {/* Driver live marker — pulsing orange car */}
        {driverMarker && (
          <Marker
            position={[driverMarker.lat, driverMarker.lng]}
            icon={createDriverIcon(driverMarker.name)}
          />
        )}

        {/* Passenger live markers */}
        {liveMarkers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={createPassengerIcon(
              marker.name ? marker.name.charAt(0).toUpperCase() : 'P',
              marker.name
            )}
          />
        ))}
      </MapContainer>

      {/* ── Route info pill ─────────────────────────────────────────────────── */}
      {routeData && (
        <div className="absolute bottom-2 left-2 z-[1000] flex gap-2 pointer-events-none">
          <span className="bg-white/95 border border-slate-200 rounded-full px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
            📍 {routeData.distanceKm} km
          </span>
          <span className="bg-white/95 border border-slate-200 rounded-full px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
            ⏱ ~{routeData.durationMin} min
          </span>
        </div>
      )}

      {/* ── Pick-mode toggle buttons (floating overlay) ── */}
      {isPickable && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-[1000]">
          {(onDepartureUpdate || onOriginPicked) && (
            <button
              type="button"
              onClick={() => setPickMode((prev) => (prev === 'origin' ? null : 'origin'))}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg border transition-all duration-200 backdrop-blur-sm ${
                pickMode === 'origin'
                  ? 'bg-green-600 text-white border-green-600 scale-105'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:border-green-400 hover:text-green-600'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {pickMode === 'origin' ? 'Click to set departure' : 'Set departure'}
            </button>
          )}
          {(onDestinationUpdate || onDestinationPicked) && (
            <button
              type="button"
              onClick={() => setPickMode((prev) => (prev === 'destination' ? null : 'destination'))}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg border transition-all duration-200 backdrop-blur-sm ${
                pickMode === 'destination'
                  ? 'bg-red-600 text-white border-red-600 scale-105'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:border-red-400 hover:text-red-600'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {pickMode === 'destination' ? 'Click to set destination' : 'Set destination'}
            </button>
          )}
          </div>
      )}

      {/* ── Loading / geocoding spinner overlay ── */}
      {(isLoading || geocoding) && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-xl pointer-events-none z-[1001]">
          <svg className="w-7 h-7 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {geocoding && (
            <span className="ml-2 text-xs font-semibold text-slate-700 bg-white/80 px-2 py-1 rounded">
              Getting address…
            </span>
          )}
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="absolute bottom-2 left-2 right-2 bg-white/90 rounded-lg px-3 py-2 text-xs text-slate-500 border border-slate-200 z-[1001]">
          {error}
        </div>
      )}
    </div>
  )
})

function MapFallback({ origin, destination, height }) {
  return (
    <div
      className="flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-orange-50 animate-fade-in"
      style={{ height, width: '100%', borderRadius: '12px', overflow: 'hidden' }}
    >
      <svg className="w-10 h-10 text-orange-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
      <p className="text-sm font-semibold text-slate-600">{origin}</p>
      <div className="flex items-center gap-2 my-1">
        <div className="w-16 h-0.5 bg-gradient-to-r from-orange-300 to-slate-300" />
        <svg className="w-3.5 h-3.5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <div className="w-16 h-0.5 bg-gradient-to-r from-slate-300 to-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-600">{destination}</p>
      <p className="text-xs text-slate-400 mt-2">Sri Lanka 🇱🇰</p>
    </div>
  )
}

export default memo(RouteMapInner)
