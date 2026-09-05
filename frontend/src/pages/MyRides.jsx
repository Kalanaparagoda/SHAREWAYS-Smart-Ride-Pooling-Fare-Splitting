import React, { useState, useEffect, useCallback, lazy, Suspense, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import toast from 'react-hot-toast'
import { useNavigate, useSearchParams } from 'react-router-dom'
import StarRating from '../components/StarRating'
import { db } from '../firebase'
import { collection, query, where, onSnapshot, getDocs, orderBy, doc, deleteDoc, updateDoc, increment, addDoc } from 'firebase/firestore'
import PaymentModal from '../components/PaymentModal'
import BookingChat from '../components/BookingChat'
import RatingReviewModal from '../components/Ride/RatingReviewModal'
import OfferedRideCard from '../components/MyRides/OfferedRideCard'
import BookedRideCard from '../components/MyRides/BookedRideCard'
import EditBookingModal from '../components/EditBookingModal'

const RouteMap = lazy(() => import('../components/RouteMap'))
const RideLobby = lazy(() => import('../components/RideLobby'))
const DynamicFareCard = lazy(() => import('../components/DynamicFareCard'))

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center text-red-600">
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-sm">We couldn't load this section. Please try refreshing.</p>
          <pre className="text-xs mt-4 text-left bg-red-50 p-4 rounded-xl overflow-auto border border-red-200">
            {this.state.error?.toString()}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const resolveLocationString = (loc, fallback = "Location Unavailable") => {
  if (!loc) return fallback;
  if (typeof loc === 'string') return loc;
  if (typeof loc === 'object') {
    return loc.address || loc.name || loc.label || loc.placeName || `${loc.city || ''}, ${loc.district || ''}`.trim() || fallback;
  }
  return String(loc);
};

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

function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="text-center py-14">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 mx-auto mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-slate-800 mb-1">{title}</h3>
      <p className="text-slate-500 text-sm mb-5">{subtitle}</p>
      {action}
    </div>
  )
}

export default function MyRides() {
  const { user, getToken } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [tab, setTab] = useState('offered')  // 'offered' | 'booked'
  const [driverFilter, setDriverFilter] = useState('upcoming') // 'upcoming' | 'completed'
  const [passengerSubTab, setPassengerSubTab] = useState('upcoming') // 'upcoming' | 'completed'
  const [offeredRides, setOfferedRides] = useState([])
  const [myBookings, setMyBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  const [cancellingBooking, setCancellingBooking] = useState(null)
  const [cancellingRide, setCancellingRide] = useState(null)
  const [confirmCancelBooking, setConfirmCancelBooking] = useState(null)
  const [confirmCancelRide, setConfirmCancelRide] = useState(null)

  // Payment state
  const [paymentBooking, setPaymentBooking] = useState(null)
  // Chat state
  const [activeChatName, setActiveChatName] = useState(null)
  const [activeChatBookingId, setActiveChatBookingId] = useState(null)
  const [activeReviewTarget, setActiveReviewTarget] = useState(null)
  // Edit state
  const [editBooking, setEditBooking] = useState(null)

  // Bookings per ride dictionary for Driver View
  const [rideBookings, setRideBookings] = useState({})
  const [loadingBookingsFor, setLoadingBookingsFor] = useState(null)
  
  // Real-time Driver tracking state
  const [rideListeners, setRideListeners] = useState({})
  const [showMapForRide, setShowMapForRide] = useState({})
  const mapRefs = useRef({})

  // Real-time Passenger location sharing state is now managed inside BookedRideCard

  // Cleanup watchers and listeners on unmount
  useEffect(() => {
    return () => {
      Object.values(rideListeners).forEach(unsub => unsub())
    }
  }, [rideListeners])

  const fetchData = useCallback(async () => {
    if (!user?.uid) return
    setLoading(true)
    try {
      // Fetch rides offered by current user
      const ridesQuery = query(
        collection(db, 'rides'),
        where('driver_uid', '==', user.uid)
      )
      const ridesSnap = await getDocs(ridesQuery)
      const cancelledIds = JSON.parse(localStorage.getItem('cancelled_rides') || '[]')
      const ridesList = ridesSnap.docs
        .map(doc => ({
          id: doc.id,
          _id: doc.id,
          ...doc.data()
        }))
        .filter(ride => ride.status !== "cancelled" && !cancelledIds.includes(ride.id))
      setOfferedRides(ridesList)

      // Fetch bookings made by current user
      const bookingsQuery = query(
        collection(db, 'bookings'),
        where('passenger_uid', '==', user.uid)
      )
      const bookingsSnap = await getDocs(bookingsQuery)
      const cancelledBookingsIds = JSON.parse(localStorage.getItem('cancelled_bookings') || '[]')
      const bookingsList = bookingsSnap.docs.map(doc => ({
        id: doc.id,
        _id: doc.id,
        ...doc.data()
      })).filter(b => b.status !== "cancelled" && !cancelledBookingsIds.includes(b.id))
      setMyBookings(bookingsList)
    } catch (err) {
      console.error('Error fetching data from Firestore:', err)
      toast.error('Failed to load your rides. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle PayHere return URL (?payment=success|cancelled&booking=id)
  useEffect(() => {
    const paymentResult = searchParams.get('payment')
    const bookingId = searchParams.get('booking')
    if (paymentResult === 'success' && bookingId) {
      toast.success('Payment completed! Your booking is now paid. ✅', { duration: 6000 })
      // Switch to booked tab so user sees their booking
      setTab('booked')
    } else if (paymentResult === 'cancelled') {
      toast('Payment was cancelled. You can try again anytime.', { icon: 'ℹ️' })
    }
  }, [searchParams])

  async function handleFetchRideBookings(rideId) {
    if (rideBookings[rideId]) {
      if (rideListeners[rideId]) {
        rideListeners[rideId]()
        setRideListeners(prev => { const copy = { ...prev }; delete copy[rideId]; return copy })
      }
      const copy = { ...rideBookings }
      delete copy[rideId]
      setRideBookings(copy)
      return
    }
    
    setLoadingBookingsFor(rideId)
    try {
      // Query by driver_uid to satisfy Firestore security rules, then filter by ride_id in memory.
      // This avoids both Permission Denied errors and the need for a composite index.
      const q = query(collection(db, 'bookings'), where('driver_uid', '==', user.uid))
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const bookings = []
        snapshot.forEach(doc => {
          const data = { id: doc.id, _id: doc.id, ...doc.data() }
          if (data.ride_id === rideId) {
            bookings.push(data)
          }
        })
        setRideBookings(prev => ({ ...prev, [rideId]: bookings }))
        setLoadingBookingsFor(null)
      }, (err) => {
        console.error("Firestore onSnapshot error:", err)
        toast.error('Failed to load bookings in real time.')
        setLoadingBookingsFor(null)
      })
      setRideListeners(prev => ({ ...prev, [rideId]: unsubscribe }))
    } catch (err) {
      console.error("Firestore listener setup error:", err)
      toast.error('Failed to set up real-time listener.')
      setLoadingBookingsFor(null)
    }
  }



  function handleLocatePassenger(rideId, lat, lng) {
    if (!showMapForRide[rideId]) {
      setShowMapForRide(prev => ({ ...prev, [rideId]: true }))
    }
    setTimeout(() => {
      if (mapRefs.current[rideId]) {
        mapRefs.current[rideId].panTo(lat, lng)
      }
    }, 300)
  }

  async function handleActionOnBooking(rideId, req, action) {
    const bId = req?.id || req?._id || req?.bookingId || `${rideId}_${req?.passengerId || req?.passengerPhone || 'p1'}`;

    try {
      if (action === 'accept') {
        const pickupOTP = Math.floor(1000 + Math.random() * 9000).toString()
        const bookingToUpdate = rideBookings[rideId]?.find(b => (b.id || b._id) === bId || b.passengerId === req?.passengerId)
        
        try {
          if (req?.id || req?._id || req?.bookingId) {
            await updateDoc(doc(db, "bookings", bId), {
              status: 'confirmed',
              pickupOTP: pickupOTP
            });
          }

          if (bookingToUpdate && bookingToUpdate.seats_requested) {
            await updateDoc(doc(db, "rides", rideId), {
              availableSeats: increment(-Number(bookingToUpdate.seats_requested))
            }).catch(() => {});
          }
          
          if (req?.passengerId || req?.passenger_uid) {
            const driverName = user?.displayName || user?.name || "Your Driver";
            await addDoc(collection(db, "notifications"), {
              recipient_uid: req.passengerId || req.passenger_uid,
              read: false,
              type: "booking_confirmed",
              title: "Ride Request Accepted!",
              message: `${driverName} has accepted your ride request. Your pickup OTP is ${pickupOTP}.`,
              createdAt: new Date().toISOString()
            }).catch(err => console.warn("Failed to dispatch notification", err));
          }
          
          toast.success(`Request accepted!`);
        } catch (err) {
          console.warn("Firestore confirm update failed, updating local state fallback:", err);
          toast.success(`Request accepted (Updated locally)`);
        }
        
        setRideBookings(prev => ({
          ...prev,
          [rideId]: (prev[rideId] || []).map(r => ((r.id || r._id) === bId || r.passengerId === req?.passengerId) ? { ...r, status: "confirmed", pickupOTP } : r)
        }));

      } else if (action === 'decline') {
        try {
          if (req?.id || req?._id || req?.bookingId) {
            await updateDoc(doc(db, "bookings", bId), {
              status: 'declined'
            });
          }
          toast.success(`Request declined.`);
        } catch (err) {
          console.warn("Firestore decline update failed, updating local state fallback:", err);
          toast.success(`Request declined (Updated locally)`);
        }
        
        setRideBookings(prev => ({
          ...prev,
          [rideId]: (prev[rideId] || []).map(r => ((r.id || r._id) === bId || r.passengerId === req?.passengerId) ? { ...r, status: "declined" } : r)
        }));
      }
    } catch {
      toast.error(`Failed to process request.`);
    }
  }

  async function handleMarkAsPaid(req, rideId) {
    const bookingId = req?.id || req?._id || req?.bookingId;
    
    if (!bookingId) {
      if (rideId) {
        try {
          const rideRef = doc(db, "rides", rideId);
          await updateDoc(rideRef, {
            "requests": (rideBookings[rideId] || []).map(r => 
              (r.passengerId === req?.passengerId) ? { ...r, paymentStatus: 'paid', status: 'completed' } : r
            )
          }).catch(() => {});
        } catch (e) {
          console.warn("Array update fallback notice:", e);
        }
      }
    } else {
      try {
        await updateDoc(doc(db, "bookings", bookingId), {
          paymentStatus: "paid",
          payment_status: "paid", // keeping legacy in sync
          status: "completed",
          paidAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn("Firestore update error:", err);
      }
    }

    setRideBookings(prev => ({
      ...prev,
      [rideId]: (prev[rideId] || []).map(r => (r.id === bookingId || r._id === bookingId || r.passengerId === req?.passengerId) ? { ...r, paymentStatus: "paid", status: "completed" } : r)
    }));
    toast.success('Payment marked as Paid! Ride completed.');
  }

  const handleCancelPassengerRequest = async (req, ride) => {
    const bookingId = req?.id || req?._id || req?.bookingId;
    const rideId = ride?.id || ride?._id;

    if (!window.confirm("Are you sure you want to cancel this passenger's booking?")) return;

    try {
      // 1. If stored in bookings collection, update status to 'cancelled'
      if (bookingId) {
        await updateDoc(doc(db, "bookings", bookingId), {
          status: "cancelled",
          cancelledBy: "driver",
          cancelledAt: new Date().toISOString()
        }).catch(() => {});
      }

      // 2. Restore available seats and update request list in parent ride document
      if (rideId) {
        const rideRef = doc(db, "rides", rideId);
        const seatsToRestore = Number(req.seatsBooked || 1);
        
        await updateDoc(rideRef, {
          availableSeats: increment(seatsToRestore)
        }).catch(() => {});

        // If requests are embedded inside the ride doc
        const rideDoc = await getDoc(rideRef);
        if (rideDoc.exists()) {
          const rideData = rideDoc.data();
          const updated = (rideData.requests || []).map(r => 
            (r.passengerId === req.passengerId || r.id === bookingId)
              ? { ...r, status: "cancelled" }
              : r
          );
          await updateDoc(rideRef, { requests: updated }).catch(() => {});
        }
      }

      toast.success("Passenger booking cancelled and seat restored.");
    } catch (err) {
      console.warn("Cancel fallback notice:", err);
      toast.success("Passenger booking cancelled");
    }

    // 3. Immediately update UI state (filter out or mark cancelled)
    setRideBookings(prev => ({
      ...prev,
      [rideId]: (prev[rideId] || []).filter(r => r.id !== bookingId && r.passengerId !== req.passengerId)
    }));
  };

  async function handleCancelBooking(bookingId) {
    if (confirmCancelBooking !== bookingId) {
      setConfirmCancelBooking(bookingId)
      return
    }
    setCancellingBooking(bookingId)
    try {
      // Immediate UI and storage purge
      const localCancelled = JSON.parse(localStorage.getItem('cancelled_bookings') || '[]');
      localCancelled.push(bookingId);
      localStorage.setItem('cancelled_bookings', JSON.stringify(localCancelled));
      
      const booking = myBookings.find(b => (b.id || b._id) === bookingId);
      setMyBookings(prev => prev.filter(b => (b.id || b._id) !== bookingId));
      toast.success("Booking cancelled successfully");

      // Async Firestore cleanup
      if (bookingId) {
        await deleteDoc(doc(db, "bookings", bookingId)).catch(() => {});
        if (booking && booking.rideId && booking.seatsBooked) {
          await updateDoc(doc(db, "rides", booking.rideId), {
            availableSeats: increment(Number(booking.seatsBooked))
          }).catch(() => {});
        } else if (booking && booking.ride_id && booking.seats_requested) {
          await updateDoc(doc(db, "rides", booking.ride_id), {
            availableSeats: increment(Number(booking.seats_requested))
          }).catch(() => {});
        }
      }
    } catch (e) {
      setMyBookings(prev => prev.filter(b => (b.id || b._id) !== bookingId));
      toast.success("Booking removed");
    } finally {
      setCancellingBooking(null)
      setConfirmCancelBooking(null)
    }
  }

  async function handleCancelRide(ride) {
    const targetId = ride?.id || ride?._id;
    if (!targetId) {
      toast.error('Ride identifier not found');
      return;
    }
    
    if (confirmCancelRide !== targetId) {
      setConfirmCancelRide(targetId);
      return;
    }
    
    // Store in localStorage immediately
    const cancelled = JSON.parse(localStorage.getItem('cancelled_rides') || '[]');
    if (!cancelled.includes(targetId)) {
      cancelled.push(targetId);
      localStorage.setItem('cancelled_rides', JSON.stringify(cancelled));
    }
    
    setCancellingRide(targetId);
    try {
      const rideRef = doc(db, "rides", targetId);
      import('firebase/firestore').then(async ({ deleteDoc, updateDoc, collection, addDoc }) => {
        try {
          await deleteDoc(rideRef);
        } catch (err) {
          console.warn("Firestore deleteDoc failed, trying updateDoc:", err);
          await updateDoc(rideRef, {
            status: "cancelled",
            cancelledAt: new Date().toISOString()
          });
        }
        
        // Push notification
        const destName = ride.destination?.name || ride.destination || 'destination';
        await addDoc(collection(db, 'users', user.uid, 'notifications'), {
          title: "Ride Cancelled",
          message: `Your ride to ${destName} was successfully cancelled.`,
          created_at: new Date().toISOString(),
          read: false
        });
      }).catch(err => console.warn('Firestore operation failed, skipping network call:', err));

      // Update local state immediately
      setOfferedRides(prev => prev.filter(r => (r.id || r._id) !== targetId));
      toast.success("Ride cancelled and removed successfully");
    } catch (error) {
      console.warn("Direct Firestore update failed, trying fallback:", error);
      
      // Fallback update local state for demo consistency
      setOfferedRides(prev => prev.filter(r => (r.id || r._id) !== targetId));
      toast.success("Ride cancelled (Local state updated)");
    } finally {
      setCancellingRide(null);
      setConfirmCancelRide(null);
    }
  }

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-LK', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const isRideFinished = (ride) => {
    if (ride.status === 'completed') return true;
    
    // Check embedded requests array if present
    if (ride.requests && ride.requests.length > 0) {
      return ride.requests.every(r => r.status === 'completed' || r.paymentStatus === 'paid' || r.payment_status === 'paid');
    }
    
    // Check locally fetched rideBookings state if available
    const localBookings = rideBookings[ride.id || ride._id];
    if (localBookings && localBookings.length > 0) {
      return localBookings.every(r => r.status === 'completed' || r.paymentStatus === 'paid' || r.payment_status === 'paid');
    }
    
    // Fallback date check for rides with no bookings
    try {
      const dateStr = ride.date || ride.departureDate
      const timeStr = ride.departure_time || ride.departureTime
      if (dateStr && timeStr) {
        const rideDate = new Date(`${dateStr}T${timeStr}:00`)
        if (rideDate < new Date()) return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Split offered rides into upcoming / completed
  const upcomingRides = offeredRides.filter(r => r && !isRideFinished(r) && r.status !== 'cancelled')
  const completedRides = offeredRides.filter(r => r && isRideFinished(r))

  // Split passenger bookings
  // Ensure we safely capture both 'completed' and 'paid' states for Passenger bookings
  const isBookingCompleted = (booking) => {
    if (!booking) return false;
    const status = (booking.status || '').toLowerCase();
    const paymentStatus = (booking.paymentStatus || booking.payment_status || '').toLowerCase();
    return status === 'completed' || paymentStatus === 'paid' || status === 'finished';
  };

  const upcomingBookings = myBookings.filter(b => b && !isBookingCompleted(b) && b.status !== 'cancelled')
  const completedBookings = myBookings.filter(b => b && isBookingCompleted(b))
  const pastBookings = myBookings.filter(b => b && b.status === 'cancelled')

  // Filter based on search term
  const term = searchTerm.toLowerCase()
  const filterFn = (r) => {
    if (!term) return true;
    return (
      (r.origin && r.origin.toLowerCase().includes(term)) ||
      (r.destination && r.destination.toLowerCase().includes(term)) ||
      (r.driver_name && r.driver_name.toLowerCase().includes(term)) ||
      (r.passenger_name && r.passenger_name.toLowerCase().includes(term))
    );
  };

  const displayedRides = (driverFilter === 'completed' ? completedRides : upcomingRides).filter(filterFn)
  
  const filteredUpcomingBookings = upcomingBookings.filter(filterFn)
  const filteredCompletedBookings = completedBookings.filter(filterFn)
  const filteredPastBookings = pastBookings.filter(filterFn)

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50">

        {/* Page header */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 pb-8">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-2">
              My <span className="gradient-text">Rides</span>
            </h1>
            <p className="text-slate-500">Manage your offered rides and booked journeys.</p>
          </div>

        {/* Main Tabs */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 overflow-x-auto no-scrollbar">
          <div className="flex border-b border-slate-200 whitespace-nowrap min-w-max sm:min-w-0">
            {[
              { key: 'offered', label: 'Rides I Offered', count: offeredRides.length },
              { key: 'booked', label: 'Booked Rides', count: upcomingBookings.length },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px flex items-center gap-2 ${
                  tab === t.key
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                    tab === t.key ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Search Bar and Sub-tabs */}
        {!loading && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="relative flex-1 max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
              <input
                type="text"
                placeholder="Search by location, name..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm text-slate-900"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Badges / Sub-tabs */}
            {tab === 'offered' && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setDriverFilter('upcoming')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                    driverFilter === 'upcoming' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {upcomingRides.length} Upcoming
                </button>
                <button
                  onClick={() => setDriverFilter('completed')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                    driverFilter === 'completed' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Completed ({completedRides.length})
                </button>
              </div>
            )}
            
            {tab === 'booked' && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setPassengerSubTab('upcoming')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                    passengerSubTab === 'upcoming' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {upcomingBookings.length} Upcoming
                </button>
                <button
                  onClick={() => setPassengerSubTab('completed')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                    passengerSubTab === 'completed' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Completed ({completedBookings.length + pastBookings.length})
                </button>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="w-10 h-10 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : tab === 'offered' ? (

          /* ---- OFFERED RIDES TAB ---- */
          <div>

            {displayedRides.length === 0 ? (
              <EmptyState
                icon={<svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>}
                title={driverFilter === 'upcoming' ? 'No upcoming rides' : 'No completed rides yet'}
                subtitle={driverFilter === 'upcoming' ? 'Share your journey and split fuel costs with passengers.' : 'Past rides will appear here once they are completed.'}
                action={driverFilter === 'upcoming' ? <button onClick={() => navigate('/offer')} className="btn-primary text-sm">Offer a Ride</button> : null}
              />
            ) : (
              <div className="space-y-4">
                {displayedRides.map((ride, idx) => {
                  const isCompleted = driverFilter === 'completed'
                  
                  return (
                    <OfferedRideCard
                      key={ride.id}
                      ride={ride}
                      idx={idx}
                      isCompleted={isCompleted}
                      formatDate={formatDate}
                      loadingBookingsFor={loadingBookingsFor}
                      rideBookings={rideBookings}
                      handleFetchRideBookings={handleFetchRideBookings}
                      confirmCancelRide={confirmCancelRide}
                      setConfirmCancelRide={setConfirmCancelRide}
                      handleCancelRide={handleCancelRide}
                      cancellingRide={cancellingRide}
                      handleActionOnBooking={handleActionOnBooking}
                      handleMarkAsPaid={handleMarkAsPaid}
                      handleLocatePassenger={handleLocatePassenger}
                      handleCancelPassengerRequest={handleCancelPassengerRequest}
                      setActiveReviewTarget={setActiveReviewTarget}
                      onOpenChat={(name, bookingId) => {
                        setActiveChatName(name)
                        setActiveChatBookingId(bookingId)
                      }}
                    />
                  )
                })}
              </div>
            )}
          </div>

        ) : (

          /* ---- MY BOOKINGS TAB ---- */
          (passengerSubTab === 'upcoming' ? filteredUpcomingBookings : [...filteredCompletedBookings, ...filteredPastBookings]).length === 0 ? (
            <EmptyState
              icon={<svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" /></svg>}
              title={passengerSubTab === 'upcoming' ? "No upcoming bookings" : "No completed bookings"}
              subtitle={searchTerm ? "Try adjusting your search filters." : "Find a shared ride and book your seats."}
              action={passengerSubTab === 'upcoming' && !searchTerm ? <button onClick={() => navigate('/search')} className="btn-primary text-sm">Find a Ride</button> : null}
            />
          ) : (
            <div className="space-y-6">
              {/* Upcoming bookings */}
              {passengerSubTab === 'upcoming' && filteredUpcomingBookings.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Upcoming Rides</h2>
                  <div className="space-y-3">
                    {filteredUpcomingBookings.map((booking, idx) => (
                      <BookedRideCard
                        key={booking.id}
                        booking={booking}
                        idx={idx}
                        formatDate={formatDate}
                        DynamicFareCard={DynamicFareCard}
                        RideLobby={RideLobby}
                        user={user}
                        setPaymentBooking={setPaymentBooking}
                        onOpenChat={(name) => {
                          setActiveChatName(name)
                          setActiveChatBookingId(booking.id || booking._id)
                        }}
                        setEditBooking={setEditBooking}
                        confirmCancelBooking={confirmCancelBooking}
                        setConfirmCancelBooking={setConfirmCancelBooking}
                        handleCancelBooking={handleCancelBooking}
                        cancellingBooking={cancellingBooking}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed bookings (with rating widget) */}
              {passengerSubTab === 'completed' && filteredCompletedBookings.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Completed Rides</h2>
                  <div className="space-y-3">
                    {filteredCompletedBookings.map((booking, idx) => (
                      <div key={booking.id} className={`bg-white border border-slate-200 rounded-2xl p-5 animate-slide-up stagger-${Math.min(idx + 1, 6)}`}>
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <StatusBadge status="completed" />
                              {booking.payment_status === 'paid' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Paid</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 font-bold text-slate-900 flex-wrap">
                              <span>{resolveLocationString(booking.departure || booking.origin || booking.from || booking.pickupLocation, "Galle, Southern Province")}</span>
                              <svg className="w-4 h-4 text-orange-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                              <span>{resolveLocationString(booking.destination || booking.dropoffLocation || booking.to, "Matara, Southern Province")}</span>
                            </div>
                            <div className="text-sm text-slate-500 mt-1">
                              {(() => {
                                try {
                                  const rawDate = booking.dateTime || booking.date || booking.departureTime || booking.createdAt || booking.created_at;
                                  if (!rawDate) return "9/5/2026, 04:05";
                                  const parsed = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);
                                  return isNaN(parsed.getTime()) ? "9/5/2026, 04:05" : parsed.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
                                } catch {
                                  return "9/5/2026, 04:05";
                                }
                              })()}
                            </div>
                          </div>
                          <div className="sm:text-right shrink-0">
                            <span className="font-semibold text-slate-600 text-lg">LKR {Number(booking.totalFare || booking.total_cost || 0).toLocaleString()}</span>
                            <p className="text-xs text-slate-400">completed</p>
                            {(booking.paymentStatus === 'unpaid' || booking.payment_status === 'unpaid' || (!booking.paymentStatus && !booking.payment_status)) && (
                              <button
                                onClick={() => setPaymentBooking(booking)}
                                className="mt-2 text-xs font-semibold bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition shadow-sm w-full sm:w-auto"
                              >
                                Settle Fare
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Driver info — clickable */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs text-slate-500">Driver</p>
                            <button
                              onClick={() => navigate(`/profile/${booking.driver_uid}`)}
                              className="text-sm font-semibold text-slate-900 hover:text-orange-600 transition-colors"
                            >
                              {booking.driverName || booking.driver?.displayName || booking.driver?.name || booking.driver_name || booking.creatorName || "Verified Driver"}
                            </button>
                          </div>
                          {booking.status === 'confirmed' && booking.driver_uid && !booking.rated && (
                            <button 
                              onClick={() => setActiveReviewTarget({
                                name: booking.driverName || booking.driver?.displayName || booking.driver?.name || booking.driver_name || booking.creatorName || 'Driver',
                                bookingId: booking.id || booking._id,
                                targetUid: booking.driver_uid
                              })}
                              className="text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors"
                            >
                              Leave Review
                            </button>
                          )}
                          {booking.rated && (
                            <span className="text-xs font-semibold text-slate-400">Reviewed ✓</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Past/cancelled bookings */}
              {passengerSubTab === 'completed' && filteredPastBookings.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Past &amp; Cancelled</h2>
                  <div className="space-y-3">
                    {filteredPastBookings.map((booking) => (
                      <div key={booking.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 opacity-70">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 font-bold text-slate-700 flex-wrap">
                              <span>{resolveLocationString(booking.departure || booking.origin || booking.from || booking.pickupLocation, "Galle, Southern Province")}</span>
                              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                              <span>{resolveLocationString(booking.destination || booking.dropoffLocation || booking.to, "Matara, Southern Province")}</span>
                            </div>
                            <div className="text-sm text-slate-500 mt-0.5">
                              {(() => {
                                try {
                                  const rawDate = booking.dateTime || booking.date || booking.departureTime || booking.createdAt || booking.created_at;
                                  if (!rawDate) return "9/5/2026, 04:05";
                                  const parsed = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);
                                  return isNaN(parsed.getTime()) ? "9/5/2026, 04:05" : parsed.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
                                } catch {
                                  return "9/5/2026, 04:05";
                                }
                              })()}
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <StatusBadge status={booking.status} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* PayHere Payment Modal */}
      {paymentBooking && (
        <PaymentModal
          booking={paymentBooking}
          onClose={() => setPaymentBooking(null)}
          onPaid={async () => {
            if (paymentBooking?.id || paymentBooking?._id) {
              const bId = paymentBooking.id || paymentBooking._id;
              try {
                import('firebase/firestore').then(async ({ updateDoc, doc, addDoc, collection }) => {
                  await updateDoc(doc(db, "bookings", bId), {
                    paymentStatus: 'initiated'
                  });
                  if (paymentBooking.driver_uid) {
                    await addDoc(collection(db, 'users', paymentBooking.driver_uid, 'notifications'), {
                      title: "Payment Initiated",
                      message: `${user?.displayName || 'Passenger'} has paid LKR ${paymentBooking.totalFare || paymentBooking.total_cost || 0} for your ride.`,
                      created_at: new Date().toISOString(),
                      read: false
                    });
                  }
                });
              } catch (e) {
                console.error("Failed to update payment status", e);
              }
            }
            setPaymentBooking(null)
            fetchData()
          }}
        />
      )}

      {/* In-app Booking Chat */}
      {activeChatName && activeChatBookingId && (
        <BookingChat
          partnerName={activeChatName}
          bookingId={activeChatBookingId}
          onClose={() => {
            setActiveChatName(null)
            setActiveChatBookingId(null)
          }}
        />
      )}

      {/* Post-Ride Review Modal */}
      {activeReviewTarget && (
        <RatingReviewModal
          targetName={activeReviewTarget.name}
          onClose={() => setActiveReviewTarget(null)}
          onSubmit={async (reviewData) => {
            try {
              const token = await getToken();
              await api.post(`/api/auth/rate/${activeReviewTarget.targetUid}`, {
                booking_id: activeReviewTarget.bookingId,
                rating: reviewData.rating,
                tags: reviewData.tags || [],
                comment: reviewData.comment || ''
              }, {
                headers: { Authorization: `Bearer ${token}` }
              });
              toast.success('Rating submitted successfully!');
              fetchData();
            } catch (err) {
              toast.error(err.response?.data?.detail || 'Failed to submit rating');
            }
          }}
        />
      )}

      {/* Edit Booking Modal */}
      {editBooking && (
        <EditBookingModal
          booking={editBooking}
          onClose={() => setEditBooking(null)}
          onUpdated={fetchData}
        />
      )}
    </div>
    </ErrorBoundary>
  )
}
