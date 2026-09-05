import { useState, useEffect, useCallback, Suspense, lazy } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import { db } from '../firebase'
import { doc, onSnapshot, collection, query, where, updateDoc } from 'firebase/firestore'
import toast from 'react-hot-toast'

import RideStatusSheet from '../components/RideStatusSheet'
import SosButton from '../components/SosButton'
const RouteMap = lazy(() => import('../components/RouteMap'))

export default function ActiveRideBoard() {
  const { rideId } = useParams()
  const { user, getToken } = useAuth()
  const navigate = useNavigate()

  const [ride, setRide] = useState(null)
  const [passengerBookings, setPassengerBookings] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch initial ride data and setup listeners
  useEffect(() => {
    if (!user || !rideId) return

    // Listen to ride document
    const unsubRide = onSnapshot(doc(db, 'rides', rideId), (snap) => {
      if (snap.exists()) {
        setRide(snap.data())
        setLoading(false)
      } else {
        toast.error('Ride not found')
        navigate('/my-rides')
      }
    })

    return () => {
      unsubRide()
    }
  }, [user, rideId, navigate])

  // Listen to confirmed bookings once ride is loaded (to determine role)
  useEffect(() => {
    if (!user || !ride) return

    const isDriver = ride.driver_uid === user.uid
    const filterField = isDriver ? 'driver_uid' : 'passenger_uid'

    // Query by driver/passenger uid to satisfy Firestore security rules
    const q = query(
      collection(db, 'bookings'),
      where(filterField, '==', user.uid)
    )
    const unsubBookings = onSnapshot(q, (snap) => {
      const bks = []
      snap.forEach(d => {
        const data = d.data()
        // In-memory filter for ride_id and status
        if (data.ride_id === rideId && data.status === 'confirmed') {
          bks.push({ id: d.id, ...data })
        }
      })
      setPassengerBookings(bks)
    }, (err) => console.error("ActiveRideBoard bookings error:", err))

    return () => unsubBookings()
  }, [user, ride, rideId])

  const isDriver = ride?.driver_uid === user?.uid

  // Driver GPS tracking
  useEffect(() => {
    if (!isDriver || !ride) return
    if (!navigator.geolocation) return

    let lastUpdate = 0
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now()
        if (now - lastUpdate < 10000) return // throttle 10s
        lastUpdate = now

        try {
          const token = await getToken()
          await api.put(`/api/rides/${rideId}/driver-location`, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }, {
            headers: { Authorization: `Bearer ${token}` }
          })
        } catch (err) {
          console.error('Failed to push driver location', err)
        }
      },
      (err) => console.warn('Driver GPS error:', err.message),
      { enableHighAccuracy: true }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [isDriver, ride, rideId, getToken])

  const advanceLifecycle = useCallback(async (nextState) => {
    try {
      const now = new Date().toISOString()
      
      // 1. Update the parent ride document
      await updateDoc(doc(db, "rides", rideId), {
        tripStatus: nextState,
        tripStatusUpdatedAt: now
      });

      // 2. Update all associated active booking documents
      const updates = passengerBookings.map(b => 
        updateDoc(doc(db, "bookings", b.id), {
          tripStatus: nextState,
          tripStatusUpdatedAt: now
        })
      );
      await Promise.all(updates);
      
      // Optionally fallback to API if needed, but direct Firestore is requested
    } catch (err) {
      console.error(err)
      toast.error('Failed to update ride status')
    }
  }, [rideId, passengerBookings])

  if (loading || !ride) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white/50 font-medium tracking-widest text-sm uppercase">Loading Board</p>
        </div>
      </div>
    )
  }

  const activeRide = ride || {};
  const departureText = typeof activeRide.departure === 'object' 
    ? (activeRide.departure?.address || activeRide.departure?.name || "Departure Location") 
    : (activeRide.departure || activeRide.origin || "Departure Location");

  const destinationText = typeof activeRide.destination === 'object' 
    ? (activeRide.destination?.address || activeRide.destination?.name || "Destination Location") 
    : (activeRide.destination || "Destination Location");

  // Prepare map markers
  const driverMarker = activeRide.driver_location
    ? { ...activeRide.driver_location, name: activeRide.driver_name }
    : null

  const liveMarkers = passengerBookings
    .filter(b => b.live_location)
    .map(b => ({
      id: b.id,
      name: b.passenger_name.split(' ')[0],
      lat: b.live_location.lat,
      lng: b.live_location.lng,
    }))

  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col overflow-hidden z-50">
      
      {/* Top Bar Overlay */}
      <div className="absolute top-0 inset-x-0 z-10 p-4 md:p-6 pointer-events-none flex items-start justify-between">
        <button
          onClick={() => navigate('/my-rides')}
          className="pointer-events-auto bg-white/90 backdrop-blur shadow-lg rounded-full w-10 h-10 flex items-center justify-center text-slate-800 hover:bg-white transition-transform active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        <div className="bg-white/90 backdrop-blur shadow-lg rounded-2xl px-4 py-2 pointer-events-auto text-right">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isDriver ? 'Your Ride' : 'Driver'}</p>
          <p className="text-sm font-bold text-slate-800">{isDriver ? 'You' : ride.driver_name}</p>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative bg-slate-800">
        <Suspense fallback={<div className="absolute inset-0 bg-slate-800" />}>
          <RouteMap
            origin={departureText}
            destination={destinationText}
            waypoints={activeRide.waypoints || []}
            height="100%"
            driverMarker={driverMarker}
            liveMarkers={liveMarkers}
          />
        </Suspense>
      </div>

      {/* Bottom Sheet Area */}
      <div className="relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.15)]">
        <RideStatusSheet
          rideId={rideId}
          isDriver={isDriver}
          onAdvance={advanceLifecycle}
        />
      </div>

      {/* SOS Emergency Button — always visible during ride */}
      <SosButton />

    </div>
  )
}
