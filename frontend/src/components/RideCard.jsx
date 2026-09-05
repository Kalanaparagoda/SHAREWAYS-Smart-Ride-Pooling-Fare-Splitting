import { useState, lazy, Suspense } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import toast from 'react-hot-toast'
import CostSplitCard from './CostSplitCard'
import { doc, updateDoc, collection, addDoc, increment } from 'firebase/firestore'
import { db } from '../firebase'

// Lazy-load the map so it only loads if expanded
const RouteMap = lazy(() => import('./RouteMap'))

export default function RideCard({ ride, onBooked, onCancelled }) {
  const { user, getToken } = useAuth()
  const navigate = useNavigate()
  const [booking, setBooking] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [seats, setSeats] = useState(1)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [showCostBreakdown, setShowCostBreakdown] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const availableSeats = Number(ride.availableSeats ?? ride.seats_left ?? ride.seats ?? 3)
  const isFull = availableSeats === 0
  const isOwnRide = user?.uid === ride.driver_uid
  const seatFare = Number(ride.fuel_cost_per_seat ?? ride.pricePerSeat ?? ride.price ?? 0)
  const totalCostForSeats = seatFare * (Number(seats) || 1)

  // Safe location extractor to prevent "Objects are not valid as a React child" crash
  const getAddressText = (loc) => {
    if (!loc) return "Location not specified";
    if (typeof loc === "string") return loc;
    return loc.address || (loc.lat ? `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}` : "Unknown Location");
  };

  // Format date nicely and safely
  const displayDate = (() => {
    const val = ride.date || ride.departureDate || ride.dateTime;
    if (!val) return "Flexible Date";
    try {
      const d = val.toDate ? val.toDate() : new Date(val.includes('T') ? val : val + 'T00:00:00');
      return isNaN(d.getTime()) ? "Scheduled" : d.toLocaleDateString('en-LK', {
        weekday: 'short', day: 'numeric', month: 'short',
      });
    } catch {
      return "Scheduled";
    }
  })();

  async function handleBook() {
    if (!user) {
      toast.error('Please log in to book a ride')
      return
    }
    setShowConfirmModal(false)
    setBooking(true)
    try {
      const bookingPayload = {
        passengerId: user.uid,
        passengerName: user.displayName || "Passenger",
        passengerPhone: user.phone || "077-1234567",
        driverId: ride.driverId || ride.userId || ride.driver_uid,
        driverName: ride.driverName || ride.driver?.displayName || ride.driver?.name || ride.creatorName || "Kalana",
        driverPhone: ride.driverPhone || ride.phone || ride.driver?.phone || "077-1234567",
        driverPhoto: ride.driverPhoto || ride.driver?.photoURL || "",
        rideId: ride.id || ride._id,
        departure: ride.departure || ride.origin || "Galle, Southern Province",
        destination: ride.destination || ride.dropoffLocation || "Matara, Southern Province",
        dateTime: ride.dateTime || ride.date || ride.departureDate || new Date().toISOString(),
        seatsBooked: seats,
        totalFare: totalCostForSeats || 684,
        farePerSeat: ride.farePerSeat || ride.fuel_cost_per_seat || ride.pricePerSeat || 684,
        vehicleType: ride.vehicleType || ride.vehicle_category || "Tuktuk",
        vehiclePlate: ride.vehiclePlate || ride.plate_number || "cbv 3008",
        status: "pending",
        paymentStatus: "unpaid",
        createdAt: new Date().toISOString(),
        
        // Keep legacy properties for backward compatibility
        ride_id: ride.id || ride._id,
        driver_uid: ride.driver_uid,
        passenger_uid: user.uid,
        seats_requested: seats
      };
      await addDoc(collection(db, 'bookings'), bookingPayload)

      toast.success('Booking confirmed!')
      if (onBooked) onBooked()
      navigate('/my-rides?tab=booked')
    } catch (err) {
      console.error(err)
      toast.error('Booking failed. Please try again.')
    } finally {
      setBooking(false)
    }
  }

  async function handleCancelRide() {
    if (!confirmCancel) {
      setConfirmCancel(true)
      return
    }
    setCancelling(true)
    try {
      const token = await getToken()
      const res = await api.delete(`/api/rides/${ride.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const notified = res.data?.notified_passengers ?? 0
      toast.success(
        notified > 0
          ? `Ride cancelled. ${notified} passenger${notified > 1 ? 's' : ''} notified.`
          : 'Your ride has been cancelled.',
      )
      onCancelled?.()
      onBooked?.() // refresh list
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to cancel ride. Please try again.'
      toast.error(msg)
    } finally {
      setCancelling(false)
      setConfirmCancel(false)
    }
  }

  // totalCostForSeats is computed at the top level now

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-orange-200 hover:shadow-md transition-all duration-300 animate-slide-up group">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">

        {/* Driver info — clickable */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/profile/${ride.driver_uid}`)}
            className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0 hover:bg-orange-700 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/50 overflow-hidden"
            title={`View ${ride.driver_name}'s profile`}
          >
            {ride.driver_photo ? (
              <img src={ride.driver_photo} alt="Driver" className="w-full h-full object-cover" />
            ) : (
              (ride.driver_name || 'D')[0].toUpperCase()
            )}
          </button>
          <div>
            <button
              onClick={() => navigate(`/profile/${ride.driver_uid}`)}
              className="font-semibold text-slate-900 text-sm hover:text-orange-600 transition-colors text-left focus:outline-none"
            >
              {ride.driver_name}
            </button>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {ride.vehicle_category && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-md">
                  {ride.vehicle_category === 'car' && '🚗'}
                  {ride.vehicle_category === 'van' && '🚐'}
                  {ride.vehicle_category === 'bike' && '🏍️'}
                  {ride.vehicle_category === 'tuktuk' && '🛺'}
                  {' '}{ride.vehicle_category.charAt(0).toUpperCase() + ride.vehicle_category.slice(1)}
                </span>
              )}
              <p className="text-xs text-slate-400">{ride.vehicle_description}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${(ride.genderPreference || ride.gender_preference) === 'Ladies Only' ? 'bg-pink-50 text-pink-600 border border-pink-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                {ride.genderPreference || ride.gender_preference || 'Co-ed Friendly'}
              </span>
              {ride.acAvailable && ride.vehicle_category !== 'bike' && ride.vehicle_category !== 'tuktuk' && (
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold tracking-wide uppercase border border-slate-200">
                  AC Available
                </span>
              )}
              {ride.luggageOk && ride.vehicle_category !== 'bike' && (
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold tracking-wide uppercase border border-slate-200">
                  Luggage Ok
                </span>
              )}
              {ride.noSmoking && (
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold tracking-wide uppercase border border-slate-200">
                  No Smoking
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Price badge */}
        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-orange-600">
            LKR {seatFare.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400">per seat</p>
        </div>
      </div>

      {/* Route */}
      <div className="mt-4 flex items-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-orange-200" />
          <div className="w-0.5 h-6 bg-gradient-to-b from-orange-300 to-slate-200" />
          <div className="w-2.5 h-2.5 rounded-full bg-slate-400 ring-2 ring-slate-200" />
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-slate-900 leading-none">{getAddressText(ride.origin || ride.departure)}</p>
          <p className="text-sm text-slate-500 leading-none">{getAddressText(ride.destination)}</p>
        </div>
      </div>

      {/* Details row */}
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {displayDate}
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {ride.departure_time || ride.departureTime || 'Time not set'}
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {isFull ? (
            <span className="text-red-500 font-semibold">Full</span>
          ) : (
            <span className="text-emerald-600 font-semibold">{availableSeats} seat{availableSeats !== 1 ? 's' : ''} left</span>
          )}
        </span>
      </div>

      {/* Notes */}
      {ride.notes && (
        <p className="mt-3 text-xs text-slate-400 italic border-l-2 border-slate-200 pl-3">
          {ride.notes}
        </p>
      )}

      {/* Toggle buttons row */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setShowMap(v => !v)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-orange-600 border border-slate-200 hover:border-orange-300 bg-slate-50 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-all font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          {showMap ? 'Hide Route' : 'Show Route'}
        </button>
        {!isOwnRide && seats > 0 && (
          <button
            type="button"
            onClick={() => setShowCostBreakdown(v => !v)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-orange-600 border border-slate-200 hover:border-orange-300 bg-slate-50 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-all font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {showCostBreakdown ? 'Hide Breakdown' : 'Cost Breakdown'}
          </button>
        )}
      </div>

      {/* Route map (lazy) */}
      {showMap && (
        <div className="mt-3 animate-slide-down">
          <Suspense fallback={<div className="h-48 shimmer rounded-xl" />}>
            <RouteMap 
              origin={getAddressText(ride.origin || ride.departure)} 
              destination={getAddressText(ride.destination)} 
              height="192px" 
            />
          </Suspense>
        </div>
      )}

      {/* Cost split breakdown */}
      {showCostBreakdown && !isOwnRide && (
        <div className="mt-3 animate-slide-down">
          <CostSplitCard
            totalCost={seatFare * Math.max((ride.total_seats || ride.availableSeats || 0) - availableSeats + seats, seats)}
            passengers={seats}
            costPerSeat={seatFare}
            compact={false}
          />
        </div>
      )}

      {/* Passenger: Book action */}
      {!isOwnRide && (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 border-t border-slate-100 pt-4">
          {isFull ? (
            <div className="flex items-center justify-between w-full">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-red-100 text-red-700">Sold Out</span>
              <button
                disabled
                className="btn-primary !px-5 !py-2 text-sm whitespace-nowrap opacity-50 cursor-not-allowed bg-slate-400"
              >
                Book Seats
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between sm:justify-start gap-4 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 font-medium">Seats</label>
                  <select
                    value={seats}
                    onChange={(e) => setSeats(Number(e.target.value))}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all duration-300 ease-in-out"
                  >
                    {Array.from({ length: Math.max(1, availableSeats) }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n} seat{n > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto sm:ml-auto">
                <div className="text-sm text-slate-500">
                  Total: <span className="text-slate-900 font-bold">LKR {Number(totalCostForSeats || 0).toLocaleString()}</span>
                </div>
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={booking || isFull}
                  className="btn-primary !px-5 !py-2 text-sm whitespace-nowrap transition-all duration-300 ease-in-out disabled:opacity-50"
                >
                  {booking ? 'Booking…' : 'Book Seats'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Confirm Seat Reservation</h3>
            <p className="text-slate-500 text-sm mb-5">
              You are booking <span className="font-semibold text-slate-700">{seats} seat{seats > 1 ? 's' : ''}</span> from {getAddressText(ride.origin || ride.departure).split(',')[0]} to {getAddressText(ride.destination).split(',')[0]}.
            </p>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-emerald-800">Total Fare</span>
                <span className="text-lg font-bold text-emerald-700">LKR {Number(totalCostForSeats || 0).toLocaleString()}</span>
              </div>
              <p className="text-xs text-emerald-600/80">Pay Cash to Driver upon drop-off or digitally when the ride completes.</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleBook}
                disabled={booking}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition disabled:opacity-70"
              >
                {booking ? 'Confirming...' : 'Confirm Reservation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver: Your ride badge + edit + cancel buttons */}
      {isOwnRide && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <span className="badge badge-orange">Your ride</span>
          <div className="flex items-center gap-2">
            {/* Edit button */}
            <button
              onClick={() => navigate(`/edit-ride/${ride.id}`)}
              className="text-xs text-blue-600 border border-blue-200 hover:bg-blue-50 font-semibold px-3 py-1.5 rounded-lg transition-all duration-300 ease-in-out flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
              Edit
            </button>

            {/* Cancel flow */}
            {confirmCancel ? (
              <>
                <span className="text-xs text-red-600 font-medium">Confirm cancel?</span>
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="text-xs text-slate-500 hover:text-slate-900 font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all duration-300 ease-in-out"
                >
                  No, keep it
                </button>
                <button
                  onClick={handleCancelRide}
                  disabled={cancelling}
                  className="text-xs bg-red-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-red-700 transition-all duration-300 ease-in-out disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                </button>
              </>
            ) : (
              <button
                onClick={handleCancelRide}
                className="text-xs text-red-600 border border-red-200 hover:bg-red-50 font-semibold px-3 py-1.5 rounded-lg transition-all duration-300 ease-in-out flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel ride
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
