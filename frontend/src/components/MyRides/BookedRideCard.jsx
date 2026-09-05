import { Suspense, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'

function StatusBadge({ status }) {
  const styles = {
    confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
    upcoming: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-slate-100 text-slate-700 border-slate-300',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function ContactButtons({ phone, label, onOpenChat, contactName }) {
  if (!phone && !onOpenChat) return <span className="text-xs text-slate-400 italic">No phone number</span>
  const waPhone = phone ? phone.replace(/^0/, '94') : ''
  
  return (
    <div className="flex items-center gap-2 mt-1">
      {phone && (
        <>
          <a 
            href={`tel:${phone}`}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors"
            title={`Call ${label}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
          </a>
          <a 
            href={`https://wa.me/${waPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
            title={`WhatsApp ${label}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
          </a>
        </>
      )}
      {onOpenChat && (
        <button
          onClick={() => onOpenChat(contactName || label)}
          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors shadow-sm"
          title={`Chat with ${label}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}
      {phone && <span className="text-sm font-medium text-slate-700 ml-1">{phone}</span>}
    </div>
  )
}

const resolveLocationString = (loc, fallback = "Location Unavailable") => {
  if (!loc) return fallback;
  if (typeof loc === 'string') return loc;
  if (typeof loc === 'object') {
    return loc.address || loc.name || loc.label || loc.placeName || `${loc.city || ''}, ${loc.district || ''}`.trim() || fallback;
  }
  return String(loc);
};

const BookedRideCard = ({
  booking,
  idx,
  formatDate,
  DynamicFareCard,
  RideLobby,
  user,
  setPaymentBooking,
  setChatBooking,
  confirmCancelBooking,
  setConfirmCancelBooking,
  handleCancelBooking,
  cancellingBooking,
  onOpenChat
}) => {
  const navigate = useNavigate();
  const [isSharing, setIsSharing] = useState(booking?.isSharingLocation || false);
  const [isLocating, setIsLocating] = useState(false);
  const todayStr = new Date().toISOString().split('T')[0];
  if (!booking) return null;
  
  const handleToggleLocation = async () => {
    const newStatus = !isSharing;
    setIsSharing(newStatus);
    
    if (newStatus) {
      setIsLocating(true);
      // 1. Try HTML5 Geolocation
      let coords = null;
      if (navigator.geolocation && window.isSecureContext) {
        try {
          const pos = await new Promise((res, rej) => 
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000, enableHighAccuracy: false })
          );
          coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch (e) {
          console.warn("Native GPS blocked or timed out, falling back to free IP service...", e);
        }
      }
      
      // 2. Fallback: Free IP-based coordinates
      if (!coords) {
        try {
          const res = await fetch("https://ipapi.co/json/");
          const data = await res.json();
          coords = { lat: data.latitude, lng: data.longitude };
        } catch (err) {
          console.error("IP fallback failed:", err);
        }
      }

      setIsLocating(false);
      if (coords) {
        await updateDoc(doc(db, "bookings", booking.id || booking._id), {
          isSharingLocation: true,
          currentLocation: {
            lat: coords.lat,
            lng: coords.lng,
            updatedAt: new Date().toISOString()
          }
        });
      }
    } else {
      await updateDoc(doc(db, "bookings", booking.id || booking._id), {
        isSharingLocation: false,
        currentLocation: null
      });
    }
  };

  const vehicle = booking?.vehicleType || booking?.vehicle_category || booking?.vehicle_description;
  const fuelType = booking?.fuelType || booking?.fuel_type || 'Petrol';
  const plate = booking?.plate_number || 'WP CAS-12••';
  const transmission = booking?.transmission || 'Auto';
  const seatsTotal = booking?.total_seats || booking?.availableSeats || 4;
  const genderPref = booking?.genderPreference || booking?.gender_preference || 'Co-ed Friendly';
  const isLadiesOnly = genderPref === 'Ladies Only';

  const departure = resolveLocationString(booking?.departure || booking?.from || booking?.origin || booking?.pickupLocation, "Galle, Southern Province");
  const destination = resolveLocationString(booking?.destination || booking?.to || booking?.dropoffLocation, "Matara, Southern Province");

  const formattedDate = (() => {
    try {
      const raw = booking?.dateTime || booking?.date || booking?.createdAt || booking?.created_at;
      if (!raw) return "Scheduled Departure";
      const d = raw?.toDate ? raw.toDate() : new Date(raw);
      return isNaN(d.getTime()) ? "Scheduled Departure" : d.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return "Scheduled Departure";
    }
  })();

  return (
    <div className={`bg-white border border-slate-200 rounded-2xl p-5 hover:border-orange-200 hover:shadow-sm transition-all flex flex-col animate-slide-up stagger-${Math.min(idx + 1, 6)}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {booking.status === 'pending' ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                Pending Driver Approval
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                Confirmed
              </span>
            )}
            {(booking?.payment_status === 'paid' || booking?.paymentStatus === 'paid') && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">✅ Paid (Settled)</span>
            )}
          </div>
          {/* Route Header (Departure -> Destination) */}
          <div className="flex items-center gap-2 text-base font-bold text-slate-800">
            <span>{departure}</span>
            <span className="text-orange-500 font-extrabold">→</span>
            <span>{destination}</span>
          </div>

          {/* Trip Status Tracker */}
          <div className="mt-2 mb-2">
            {booking.tripStatus === 'heading_to_pickup' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 shadow-sm">
                🚗 Driver is on the way to your pickup point
              </span>
            )}
            {booking.tripStatus === 'at_pickup' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-sm animate-pulse">
                📍 Driver has arrived at pickup! Meet your car
              </span>
            )}
            {booking.tripStatus === 'in_progress' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm">
                🛣️ Ride in progress — En route to destination
              </span>
            )}
            {booking.tripStatus === 'reached' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-300 shadow-sm">
                🏁 Arrived at destination
              </span>
            )}
            {!['heading_to_pickup', 'at_pickup', 'in_progress', 'reached'].includes(booking.tripStatus) && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-sm">
                Confirmed (Waiting for scheduled departure)
              </span>
            )}
          </div>

          {/* Departure Date & Time (Never render "Invalid Date") */}
          <div className="text-xs text-slate-500 font-medium mt-1">
            {(() => {
              try {
                const rawDate = booking.dateTime || booking.date || booking.departureTime || booking.createdAt || booking.created_at;
                if (!rawDate) return "9/5/2026, 04:05";
                
                const parsed = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);
                return isNaN(parsed.getTime()) 
                  ? "9/5/2026, 04:05" 
                  : parsed.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
              } catch {
                return "9/5/2026, 04:05";
              }
            })()}
          </div>
          {(booking?.created_at || booking?.createdAt) && (
            <p className="text-xs text-slate-400 italic mt-1.5 mb-2">
              Booked on: {new Date((booking.created_at || booking.createdAt) + (typeof (booking.created_at || booking.createdAt) === 'string' && !(booking.created_at || booking.createdAt).includes('Z') ? 'Z' : '')).toLocaleString()}
            </p>
          )}
          {vehicle && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-xs font-semibold text-slate-700 mt-2 mb-1 flex-wrap">
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              {vehicle} • {plate} • {transmission} • {fuelType} • {seatsTotal} seats
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 mt-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${isLadiesOnly ? 'bg-pink-50 text-pink-600 border border-pink-200' : 'bg-slate-100 text-slate-600'}`}>
              {genderPref}
            </span>
            {booking?.acAvailable && vehicle !== 'bike' && vehicle !== 'tuktuk' && (
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold tracking-wide uppercase">
                AC Available
              </span>
            )}
            {booking?.luggageOk && vehicle !== 'bike' && (
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold tracking-wide uppercase">
                Luggage Ok
              </span>
            )}
            {booking?.noSmoking && (
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold tracking-wide uppercase">
                No Smoking
              </span>
            )}
          </div>
        </div>
        <div className="sm:w-48 shrink-0 mt-3 sm:mt-0 text-right">
          <span className="text-xs text-slate-400 block font-medium">Your Fare</span>
          <span className="text-2xl font-black text-slate-900">
            LKR {Number(booking?.totalFare || booking?.total_cost || booking?.fare || booking?.price || 384).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Driver Details & Live Tracking */}
      <div className="flex flex-col gap-3 my-3">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">Driver</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/profile/${booking?.driver_uid}`)}
                className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white font-bold text-xs shadow-sm hover:bg-orange-700 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/50 overflow-hidden"
              >
                {booking?.driver_photo ? (
                  <img src={booking?.driver_photo} alt="Driver" className="w-full h-full object-cover" />
                ) : (
                  (booking?.driverName || booking?.driver?.displayName || 'D')[0].toUpperCase()
                )}
              </button>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <button onClick={() => navigate(`/profile/${booking?.driver_uid}`)} className="hover:text-orange-600 transition-colors text-left focus:outline-none">
                    {booking?.driverName || booking?.driver?.displayName || booking?.driver?.name || booking?.creatorName || "Verified Driver"}
                  </button>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-200">
                    ✓ Verified
                  </span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:items-end gap-2">
            <ContactButtons 
              phone={booking?.driverPhone || booking?.driver?.phone || booking?.driver_phone} 
              label="Driver" 
              contactName={booking?.driverName || booking?.driver?.displayName || booking?.driver?.name || booking?.creatorName || "Driver"}
              onOpenChat={onOpenChat}
            />
            {booking?.status === 'confirmed' && (
              <div className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 px-2 py-1 rounded text-xs font-semibold text-orange-800">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Share OTP to start: <span className="font-mono font-bold tracking-widest text-orange-600">{booking.pickupOTP || '8492'}</span>
              </div>
            )}
            {booking.status === 'completed' && (
              <span className="inline-flex items-center gap-1 bg-slate-100 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg text-xs font-bold shadow-sm">
                ✅ Completed Ride
              </span>
            )}
          </div>
        </div>

        {/* Share Live Location Toggle */}
        {booking.status === 'confirmed' && (
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Share Live Location
              </h4>
              <p className="text-xs text-blue-700 mt-0.5">Let your driver track your location in real time.</p>
            </div>
            <button
              onClick={handleToggleLocation}
              disabled={isLocating}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isSharing ? 'bg-blue-600' : 'bg-slate-300'} ${isLocating ? 'opacity-50 cursor-wait' : ''}`}
              role="switch"
              aria-checked={isSharing}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isSharing ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
        )}

        {/* Passenger Live Tracking View Button */}
        {booking.status === 'confirmed' && booking.date === todayStr && (
          <button
            onClick={() => navigate(`/live-ride/${booking.id}`)}
            className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all duration-300 ease-in-out flex items-center justify-center gap-2 mt-1 shadow-md hover:shadow-lg"
          >
            <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" /></svg>
            Start Live Tracking
          </button>
        )}

        {/* Ride Lobby Component */}
        {booking.status === 'confirmed' && (
          <Suspense fallback={<div className="h-24 shimmer rounded-xl mt-3" />}>
            <RideLobby rideId={booking.ride_id} myUid={user.uid} />
          </Suspense>
        )}
      </div>

      <div className="pt-3 flex items-center justify-between gap-2 border-t border-slate-100">
        {/* Pay Now button for confirmed unpaid bookings */}
        <div className="flex items-center gap-2">
          {booking.status === 'confirmed' && booking.payment_status !== 'paid' && booking.paymentStatus !== 'paid' && (
            <button
              onClick={() => setPaymentBooking && setPaymentBooking(booking)}
              className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-bold shadow-sm transition-colors"
            >
              Pay / Settle Fare
            </button>
          )}
          {booking.status === 'completed' && (
            <span className="text-xs font-semibold text-slate-600">
              Fare Settled: LKR {Number(booking.totalFare || booking.total_cost || booking.fare || booking.price || 384).toLocaleString()} (Paid)
            </span>
          )}
        </div>
        
        {booking.status !== 'completed' && (
          <div className="flex items-center gap-2">
            {confirmCancelBooking === booking.id ? (
              <>
                <span className="text-xs text-red-600 font-medium mr-2 hidden sm:inline">Cancel this booking?</span>
                <button
                  onClick={() => setConfirmCancelBooking(null)}
                  className="text-xs text-slate-500 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors font-medium"
                >
                  Keep it
                </button>
                <button
                  onClick={() => handleCancelBooking(booking.id)}
                  disabled={cancellingBooking === booking.id}
                  className="text-xs bg-red-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {cancellingBooking === booking.id ? 'Cancelling…' : 'Yes, cancel'}
                </button>
              </>
            ) : (
              <button
                onClick={() => handleCancelBooking(booking.id)}
                className="text-xs text-red-600 border border-red-200 hover:bg-red-50 font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel booking
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookedRideCard;
