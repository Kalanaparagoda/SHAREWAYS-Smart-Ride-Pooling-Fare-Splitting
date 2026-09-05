import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../firebase'
import { doc, onSnapshot, updateDoc } from 'firebase/firestore'
import toast from 'react-hot-toast'

// ─── Leaflet marker icon fix ─────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const SL_CENTER = /** @type {[number, number]} */ ([7.8731, 80.7718])

// ─── Custom icons ─────────────────────────────────────────────────────────────
const driverIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:20px;height:20px;border-radius:50%;
    background:#2563EB;border:3px solid #fff;
    box-shadow:0 0 0 4px rgba(37,99,235,0.25),0 2px 8px rgba(0,0,0,0.3);">
  </div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

const destinationIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:28px;height:28px;border-radius:50%;
    background:#dc2626;color:#fff;font-weight:bold;font-size:13px;
    display:flex;align-items:center;justify-content:center;
    border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);">
    B
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

// ─── Pure-JS Haversine distance ────
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Map auto-pan helper ──────────────────────────────────────────────────────
function MapFollower({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) {
      map.panTo([position.lat, position.lng])
    }
  }, [map, position])
  return null
}

// ─── LiveRide Page ────────────────────────────────────────────────────────────
export default function LiveRide() {
  const { rideId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [ride, setRide] = useState(null)
  const [loading, setLoading] = useState(true)
  const [geofenceTriggered, setGeofenceTriggered] = useState(false)

  const watchId = useRef(/** @type {number|null} */ (null))
  const geofenceRef = useRef(false)

  // ── 1. Fetch ride document & setup onSnapshot ────────────────────────────────
  useEffect(() => {
    if (!rideId) return

    const unsubRide = onSnapshot(doc(db, 'rides', rideId), (snap) => {
      if (snap.exists()) {
        setRide({ id: snap.id, ...snap.data() })
        setLoading(false)
      } else {
        toast.error('Ride not found.')
        navigate('/my-rides')
      }
    })

    return () => unsubRide()
  }, [rideId, navigate])

  const isDriver = ride?.driver_uid === user?.uid
  const destLatLng = ride?.destination?.lat && ride?.destination?.lng
    ? { lat: ride.destination.lat, lng: ride.destination.lng }
    : null

  // ── 2. Driver GPS streaming ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isDriver || !rideId) return
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.')
      return
    }

    watchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speed: position.coords.speed || 0,
        }
        
        // Write to Firestore
        try {
          await updateDoc(doc(db, 'rides', rideId), { currentLocation: pos })
        } catch (err) {
          console.error("Failed to push driver location", err)
        }
      },
      (err) => {
        console.error('[LiveRide] geolocation error:', err)
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    )

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current)
      }
    }
  }, [isDriver, rideId])

  // ── 3. Passenger Geofencing (Local Check) ──────────────────────────────────
  useEffect(() => {
    if (isDriver || !ride?.currentLocation || !destLatLng) return

    const { lat, lng } = ride.currentLocation
    const distMeters = haversineMeters(lat, lng, destLatLng.lat, destLatLng.lng)
    
    if (distMeters < 500 && !geofenceRef.current) {
      geofenceRef.current = true
      setGeofenceTriggered(true)
      toast('📍 You are approaching your drop-off location.', {
        duration: 6000,
        style: {
          background: '#EFF6FF',
          color: '#1E3A8A',
          border: '1px solid #BFDBFE',
        },
      })
    }
  }, [ride?.currentLocation, destLatLng, isDriver])

  // ─── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center animate-fade-in">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Initializing Live Tracking...</p>
      </div>
    )
  }

  if (!ride) return null

  const currentPosition = ride.currentLocation
  const mapCenter = currentPosition
    ? ([currentPosition.lat, currentPosition.lng])
    : (ride.departure?.lat && ride.departure?.lng ? [ride.departure.lat, ride.departure.lng] : SL_CENTER)

  const distanceLeftMeters = currentPosition && destLatLng 
    ? haversineMeters(currentPosition.lat, currentPosition.lng, destLatLng.lat, destLatLng.lng)
    : null;
    
  const distanceLeftKm = distanceLeftMeters ? (distanceLeftMeters / 1000).toFixed(1) : null;
  const etaMinutes = distanceLeftMeters ? Math.ceil((distanceLeftMeters / 1000) / 40 * 60) : null; // Assuming 40 km/h avg speed

  const handleShareTrip = () => {
    const shareUrl = `${window.location.origin}/live-ride/${ride.id}`;
    const message = encodeURIComponent(`Track my ride live on ShareWays! ${shareUrl}`);
    const waLink = `https://wa.me/?text=${message}`;
    window.open(waLink, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col h-screen overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="bg-white px-4 py-4 border-b border-slate-200 shadow-sm z-10 flex items-center gap-4">
        <button
          onClick={() => navigate('/my-rides')}
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="font-bold text-slate-900 text-lg">Live Ride</h1>
          <p className="text-xs text-slate-500 font-medium">Tracking to {ride.destination?.address || ride.destination || 'Destination'}</p>
        </div>
        <button
          onClick={handleShareTrip}
          className="ml-auto flex items-center gap-1 text-xs font-semibold bg-orange-50 text-orange-600 px-3 py-1.5 rounded-full hover:bg-orange-100 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          Share
        </button>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {/* "Locating you" overlay until first GPS fix */}
        {!currentPosition && (
          <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
            <p className="text-blue-900 font-semibold">{isDriver ? 'Acquiring GPS...' : 'Waiting for Driver Location...'}</p>
          </div>
        )}

        <MapContainer
          center={mapCenter}
          zoom={15}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {/* Auto-pan map to follow current position */}
          <MapFollower position={currentPosition} />

          {/* Straight-line from current position to destination */}
          {currentPosition && destLatLng && (
            <Polyline
              positions={[
                [currentPosition.lat, currentPosition.lng],
                [destLatLng.lat, destLatLng.lng],
              ]}
              pathOptions={{ color: '#2563EB', weight: 4, opacity: 0.8 }}
            />
          )}

          {/* Current position — blue dot */}
          {currentPosition && (
            <Marker
              position={[currentPosition.lat, currentPosition.lng]}
              icon={driverIcon}
            />
          )}

          {/* Destination marker — red B */}
          {destLatLng && (
            <Marker
              position={[destLatLng.lat, destLatLng.lng]}
              icon={destinationIcon}
            />
          )}
        </MapContainer>

        {/* Geofence banner overlay */}
        {geofenceTriggered && (
          <div className="absolute top-4 left-4 right-4 z-20 animate-slide-down">
            <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg flex items-start gap-3">
              <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="font-bold text-sm">Approaching Destination</h4>
                <p className="text-blue-100 text-xs mt-0.5">You are less than 500m from your drop-off.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Driver Info Sheet */}
      <div className="bg-white p-5 rounded-t-3xl shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-10 relative">
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Your Driver</p>
            <h3 className="text-lg font-bold text-slate-900">{ride.driver_name}</h3>
            {ride.vehicleType && (
              <p className="text-sm text-slate-600">{ride.vehicleType}</p>
            )}
          </div>
          {ride.driver_email && (
            <button
              className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center hover:bg-green-200 transition-colors shadow-sm shrink-0"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
            </button>
          )}
        </div>
        
        {/* ETA & Distance */}
        <div className="mt-4 flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 uppercase font-semibold">Distance</span>
            <span className="text-lg font-bold text-slate-800">{distanceLeftKm !== null ? `${distanceLeftKm} km` : '...'}</span>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 uppercase font-semibold">ETA</span>
            <span className="text-lg font-bold text-orange-600">{etaMinutes !== null ? `${etaMinutes} min` : '...'}</span>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 uppercase font-semibold">Status</span>
            <span className="text-sm font-bold text-green-600 mt-0.5">On time</span>
          </div>
        </div>
      </div>
    </div>
  )
}
