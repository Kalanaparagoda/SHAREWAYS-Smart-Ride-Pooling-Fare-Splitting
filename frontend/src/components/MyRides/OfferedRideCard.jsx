import { useNavigate } from 'react-router-dom'
import { Suspense } from 'react'

// ─── Safe Formatters ────────────────────────────────────────────────────────
const safeStr = (val, fallback = '') => (typeof val === 'string' ? val : fallback)

const safeMoney = (val) => {
  const n = Number(val)
  return isNaN(n) ? '0' : n.toLocaleString()
}

const safeDate = (val) => {
  if (!val) return 'Date not specified'
  if (val?.toDate) return val.toDate().toLocaleDateString()
  const parsed = new Date(val)
  return isNaN(parsed.getTime()) ? 'Date not specified' : parsed.toLocaleDateString()
}

const safeTimestamp = (val) => {
  if (!val) return null
  try {
    if (val?.toDate) return val.toDate().toLocaleString()
    const parsed = new Date(val + (typeof val === 'string' && !val.includes('T') ? 'Z' : ''))
    return isNaN(parsed.getTime()) ? null : parsed.toLocaleString()
  } catch {
    return null
  }
}

const getPlaceName = (val, fallback) => {
  if (!val) return fallback
  if (typeof val === 'string') return val
  if (val.name) return val.name
  if (val.address) return val.address
  return fallback
}

// ─── Sub-components ─────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = safeStr(status, 'unknown')
  const styles = {
    confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
    upcoming: 'bg-blue-50 text-blue-700 border-blue-200',
    active: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-slate-100 text-slate-700 border-slate-300',
    unknown: 'bg-slate-100 text-slate-600 border-slate-200',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[s] || styles.unknown}`}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  )
}

function ContactButtons({ phone, label, onOpenChat, contactName }) {
  if (!phone && !onOpenChat) return <span className="text-xs text-slate-400 italic">No phone number</span>
  const waPhone = phone ? String(phone).replace(/^0/, '94') : ''
  return (
    <div className="flex items-center gap-2 mt-1">
      {phone && (
        <>
          <a href={`tel:${phone}`} className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors" title={`Call ${label}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
          </a>
          <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title={`WhatsApp ${label}`}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
          </a>
        </>
      )}
      {onOpenChat && (
        <button onClick={() => onOpenChat(contactName || label)} className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors" title={`Chat with ${label}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}
      {phone && <span className="text-sm font-medium text-slate-700 ml-1">{phone}</span>}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function OfferedRideCard({
  ride,
  idx = 0,
  isCompleted,
  loadingBookingsFor,
  rideBookings,
  handleFetchRideBookings,
  confirmCancelRide,
  setConfirmCancelRide,
  cancellingRide,
  handleCancelRide,
  handleActionOnBooking,
  handleMarkAsPaid,
  handleLocatePassenger,
  onOpenChat,
  setActiveReviewTarget,
}) {
  const navigate = useNavigate()

  if (!ride) return null

  // Ensure locations are strings
  const originName = getPlaceName(ride.departure, null) || safeStr(ride.origin, 'Unknown Origin')
  const destName   = getPlaceName(ride.destination, null) || safeStr(ride.destination, 'Unknown Destination')
  
  const priceVal   = ride.pricePerSeat ?? ride.fuel_cost_per_seat ?? 0
  const seatsAvail = ride.availableSeats ?? ride.seats_left ?? 0
  const seatsTotal = ride.total_seats ?? ride.availableSeats ?? 0
  const vehicle    = ride.vehicleType || ride.vehicle_category || ride.vehicle_description || 'Vehicle'
  const fuelType   = ride.fuelType || ride.fuel_type || 'Petrol'
  const plate      = ride.plate_number || 'WP CAS-12••'
  const transmission = ride.transmission || 'Auto'
  const genderPref = ride.genderPreference || ride.gender_preference || 'Co-ed Friendly'
  const isLadiesOnly = genderPref === 'Ladies Only'
  const dateLabel  = safeDate(ride.departureDate || ride.date)
  const timeLabel  = ride.departureTime || ride.departure_time || 'Time not set'
  const statusVal  = ride.status === 'cancelled' ? 'cancelled' : (isCompleted ? 'completed' : (ride.status || 'upcoming'))
  
  // Passengers for avatars
  const bookings = (rideBookings && rideBookings[ride.id]) ? rideBookings[ride.id].filter(b => b.status !== 'cancelled') : []
  const hasBookingsLoaded = rideBookings && rideBookings[ride.id]
  const displayPassengers = bookings.slice(0, 3)
  const extraPassengers = Math.max(0, bookings.length - 3)

  // Earnings and passengers calculation
  const settledBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed' || b.paymentStatus === 'paid' || b.payment_status === 'paid');
  
  let passengerCount = 0;
  let totalEarnings = 0;

  if (settledBookings.length > 0) {
    settledBookings.forEach(b => {
      passengerCount += Number(b.seatsBooked || b.seats_requested || 1);
      totalEarnings += Number(b.totalFare || b.fare || b.price || (priceVal * Number(b.seatsBooked || b.seats_requested || 1)));
    });
  } else if (ride.requests && ride.requests.length > 0) {
    const settledRequests = ride.requests.filter(r => r.status === 'confirmed' || r.status === 'completed' || r.paymentStatus === 'paid' || r.payment_status === 'paid');
    settledRequests.forEach(r => {
      passengerCount += Number(r.seatsBooked || r.seats_requested || 1);
      totalEarnings += Number(r.totalFare || r.fare || (priceVal * Number(r.seatsBooked || r.seats_requested || 1)));
    });
  }

  // Fallback for purely completed rides with no request data
  if (isCompleted) {
    if (passengerCount === 0) passengerCount = Math.max(1, seatsTotal - seatsAvail);
    if (totalEarnings === 0) totalEarnings = priceVal * passengerCount;
  }

  return (
    <div className={`bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-sm transition-all flex flex-col mb-4 animate-slide-up stagger-${Math.min(idx + 1, 6)}`}>

      <div className="flex flex-col md:flex-row gap-6">
        {/* ── Left Column: Avatars & Status ── */}
        <div className="flex flex-row md:flex-col items-center md:items-start gap-4 md:w-[140px] shrink-0">
          <div className="flex -space-x-2 overflow-hidden">
            {displayPassengers.length > 0 ? (
              <>
                {displayPassengers.map((b, i) => (
                  <img 
                    key={b.id || i}
                    className="inline-block h-10 w-10 rounded-full ring-2 ring-white bg-slate-100 object-cover" 
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(b.passenger_name || 'P')}&background=random`} 
                    alt={b.passenger_name || 'Passenger'} 
                  />
                ))}
                {extraPassengers > 0 && (
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full ring-2 ring-white bg-slate-100 text-xs font-medium text-slate-500">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 12a2 2 0 11-4 0 2 2 0 014 0zM14 12a2 2 0 11-4 0 2 2 0 014 0zM22 12a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                )}
              </>
            ) : (
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full ring-2 ring-white bg-slate-50 text-slate-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>
          <StatusBadge status={statusVal} />
        </div>

        {/* ── Middle Column: Route & Schedule ── */}
        <div className="flex-1 border-l-0 md:border-l border-slate-100 md:pl-6">
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="font-bold text-slate-800 text-sm">Me (Driver)</span>
              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                Verified
              </span>
            </div>
          </div>
          <div className="relative">
            {/* Vertical Dashed Line */}
            <div className="absolute left-[9px] top-7 bottom-7 w-0 border-l-2 border-dashed border-slate-200"></div>

            {/* Departure */}
            <div className="flex gap-3 mb-4">
              <div className="mt-1 relative z-10 shrink-0">
                <div className="w-5 h-5 flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Departure</p>
                <p className="text-sm font-bold text-slate-900">{originName}</p>
                <p className="text-xs text-slate-500 mt-1">{dateLabel}, {timeLabel}</p>
              </div>
            </div>

            {/* Destination */}
            <div className="flex gap-3">
              <div className="mt-1 relative z-10 shrink-0">
                <div className="w-5 h-5 flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Destination</p>
                <p className="text-sm font-bold text-slate-900">{destName}</p>
                <p className="text-xs text-slate-500 mt-1">{dateLabel}, {timeLabel}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column: Vehicle, Pricing, Actions ── */}
        <div className="flex-1 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 flex flex-col justify-between">
          
          {isCompleted ? (
            <div className="flex items-center justify-between h-full">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-slate-400 mb-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <span className="font-bold text-slate-900">{passengerCount}</span>
                <span className="text-xs text-slate-500">Passenger{passengerCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 mb-1">Total Fuel Split</p>
                <p className="text-lg font-bold text-slate-900">LKR {safeMoney(totalEarnings)}</p>
              </div>
            </div>
          ) : (
            <>
              <div>
              <div className="flex flex-col gap-3 mb-4">
                {/* Vehicle Card Header & Specs */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🚗</span>
                      <span className="text-sm font-bold text-slate-900 capitalize">{vehicle}</span>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded border border-slate-400 bg-amber-50 text-slate-900 font-mono font-bold text-xs shadow-sm tracking-wider">
                      {plate}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-md font-medium">
                      {transmission}
                    </span>
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                      {fuelType.includes('EV') || fuelType.includes('Electric') ? '⚡' : '⛽'} {fuelType}
                    </span>
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                      💺 {seatsTotal} seats
                    </span>
                  </div>
                </div>
                
                {/* Ride Tags */}
                <div className="flex flex-wrap gap-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${isLadiesOnly ? 'bg-pink-50 text-pink-600 border border-pink-200' : 'bg-slate-100 text-slate-600'}`}>
                    {genderPref}
                  </span>
                  {ride.acAvailable && vehicle !== 'bike' && vehicle !== 'tuktuk' && (
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold tracking-wide uppercase">
                      AC Available
                    </span>
                  )}
                  {ride.luggageOk && vehicle !== 'bike' && (
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold tracking-wide uppercase">
                      Luggage Ok
                    </span>
                  )}
                  {ride.noSmoking && (
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold tracking-wide uppercase">
                      No Smoking
                    </span>
                  )}
                </div>
              </div>
                <div className="space-y-2 text-sm border-b border-slate-100 pb-4 mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fare per Seat:</span>
                    <span className="font-semibold text-slate-900">LKR {safeMoney(priceVal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Fuel Split:</span>
                    <span className="font-semibold text-slate-900">LKR {safeMoney(priceVal * seatsTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-auto">
                <button
                  onClick={() => handleFetchRideBookings && handleFetchRideBookings(ride.id)}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors text-center"
                >
                  {loadingBookingsFor === ride.id ? 'Loading...' : hasBookingsLoaded ? 'Hide Details' : 'View Details'}
                </button>
                {confirmCancelRide === ride.id ? (
                  <div className="flex-1 flex gap-1">
                    <button onClick={() => setConfirmCancelRide && setConfirmCancelRide(null)} className="flex-1 text-xs text-slate-500 border border-slate-200 rounded-lg py-2 bg-slate-50 font-medium">Keep</button>
                    <button onClick={() => handleCancelRide && handleCancelRide(ride)} disabled={cancellingRide === (ride.id || ride._id)} className="flex-1 text-xs text-red-600 border border-red-200 rounded-lg py-2 hover:bg-red-50 font-semibold disabled:opacity-50">
                      {cancellingRide === (ride.id || ride._id) ? "Cancelling..." : "Yes"}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmCancelRide && setConfirmCancelRide(ride.id)} className="flex-1 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-600 text-xs font-semibold py-2 px-4 rounded-lg transition-colors text-center">
                    Cancel Ride
                  </button>
                )}
              </div>
            </>
          )}

        </div>
      </div>

      {/* ── Passenger bookings Detail View (Expanded) ── */}
      {hasBookingsLoaded && (
        <div className="mt-6 pt-6 border-t border-slate-100 bg-slate-50 -mx-5 -mb-5 p-5 rounded-b-2xl">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Passenger Requests</h4>
            <button onClick={() => navigate(`/ride/${ride.id}`)} className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
              Launch Ride Board
            </button>
          </div>

          {bookings.length === 0 ? (
            <p className="text-sm text-slate-500">No active requests.</p>
          ) : (
            <div className="space-y-3">
              {bookings.map((b, bi) => (
                <div key={b.id || bi} className={`flex flex-col gap-3 bg-white p-4 rounded-lg border shadow-sm ${b.status === 'pending' ? 'border-amber-200' : 'border-slate-200'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {b.paymentStatus === 'paid' || b.payment_status === 'paid' || b.status === 'completed' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">✅ Completed & Paid</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                            Confirmed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <button onClick={() => navigate(`/profile/${b.passenger_uid}`)} className="font-semibold text-slate-900 text-sm hover:text-orange-600 transition-colors text-left">
                          {b.passenger_name || 'Passenger'}
                        </button>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${(b.passenger_gender || 'Male') === 'Female' ? 'bg-pink-50 text-pink-600 border border-pink-200' : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>
                          {b.passenger_gender || 'Male'}
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold">
                          {b.seats_requested || 1} Seat{(b.seats_requested || 1) > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-2 flex-wrap mt-1">
                        {/* Phone Call Icon */}
                        <a
                          href={`tel:${b.passenger_phone || '0771234567'}`}
                          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 flex items-center justify-center transition-colors shadow-sm"
                          title="Call Passenger"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </a>

                        {/* WhatsApp Icon */}
                        <a
                          href={`https://wa.me/${(b.passenger_phone || '94771234567').replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/20 flex items-center justify-center transition-colors shadow-sm"
                          title="Chat on WhatsApp"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.587 1.961.949 2.8.949 3.176 0 5.765-2.587 5.765-5.766.001-3.18-2.585-5.766-5.769-5.766zm3.394 8.163c-.143.402-.832.766-1.143.816-.312.049-.684.072-2.18-.546-1.782-.738-2.91-2.56-3.001-2.679-.089-.12-1.282-1.706-1.282-3.254 0-1.547.81-2.311 1.098-2.624.288-.313.63-.391.84-.391.21 0 .42.002.604.011.196.01.458-.075.717.546.268.641.916 2.234.996 2.398.08.164.133.356.023.576-.11.22-.165.357-.33.551-.164.193-.347.432-.496.58-.164.164-.336.342-.144.671.192.329.852 1.408 1.83 2.279 1.258 1.121 2.317 1.468 2.646 1.632.329.165.52.138.713-.083.193-.22.824-.961 1.044-1.291.22-.329.44-.275.736-.165.297.11 1.884.887 2.207 1.051.324.165.54.248.622.385.083.137.083.796-.06 1.198z" />
                          </svg>
                        </a>


                        {/* Clean Phone text */}
                        <span className="text-sm font-medium text-slate-700 ml-1">
                          {b.passenger_phone || '077-1234567'}
                        </span>
                        
                        {/* Pickup OTP */}
                        {b.status === 'confirmed' && (
                          <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-800 border border-orange-200 rounded-lg text-[10px] font-bold">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Pickup OTP: <span className="text-orange-600 tracking-widest">{b.pickupOTP || '8492'}</span>
                          </div>
                        )}

                        {b.isSharingLocation && b.currentLocation?.lat && b.currentLocation?.lng && (
                          <button
                            onClick={() => window.open(`https://www.google.com/maps?q=${b.currentLocation.lat},${b.currentLocation.lng}`, '_blank')}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[10px] font-bold border border-blue-200"
                          >
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                            </span>
                            Locate
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="sm:text-right shrink-0">
                      <p className="text-xs text-slate-400">Total Fare</p>
                      <p className="text-sm font-bold text-slate-700">
                        LKR {Number(b.totalFare || b.total_cost || ((b.seatsBooked || b.seats_requested || 1) * (ride.farePerSeat || ride.pricePerSeat || 384)) || ride.farePerSeat || ride.pricePerSeat || 384).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {b.paymentStatus === 'paid' || b.payment_status === 'paid' || b.status === 'completed' ? (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1.5 font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        ✓ Fare Settled & Trip Concluded
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-600">
                          Collected: LKR {Number(b.totalFare || b.total_cost || b.fare || 684).toLocaleString()}
                        </span>
                        {!b.driver_rated ? (
                          <button 
                            onClick={() => {
                              if (setActiveReviewTarget) {
                                setActiveReviewTarget({
                                  name: b.passenger_name || 'Passenger',
                                  bookingId: b.id || b._id,
                                  targetUid: b.passenger_uid
                                })
                              }
                            }}
                            className="text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors"
                          >
                            Rate Passenger
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">Reviewed ✓</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                      {b.status === 'pending' && (
                        <>
                          <button onClick={() => handleActionOnBooking && handleActionOnBooking(ride.id, b, 'accept')} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg !px-3 !py-1.5 !text-xs font-semibold transition">Accept Request</button>
                          <button onClick={() => handleActionOnBooking && handleActionOnBooking(ride.id, b, 'decline')} className="text-red-600 bg-white border border-red-200 rounded-lg !px-3 !py-1.5 !text-xs font-semibold hover:bg-red-50 transition">Decline</button>
                        </>
                      )}
                      {b.status === 'confirmed' && (
                        <>
                          <button onClick={() => handleMarkAsPaid && handleMarkAsPaid(b, ride.id)} className="bg-emerald-600 text-white rounded-lg !px-3 !py-1.5 !text-xs font-semibold">Mark as Paid</button>
                          <button onClick={() => handleCancelPassengerRequest && handleCancelPassengerRequest(b, ride)} className="text-red-600 bg-red-50 border border-red-200 rounded-lg !px-3 !py-1.5 !text-xs font-semibold hover:bg-red-100">Cancel</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}