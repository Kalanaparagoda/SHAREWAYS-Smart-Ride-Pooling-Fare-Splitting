import { useState, useCallback, lazy, Suspense } from 'react'
import RideCard from '../components/RideCard'
import LocationAutocomplete from '../components/LocationAutocomplete'
import api from '../api'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { RideCardSkeleton } from '../components/Skeletons'

const RouteMap = lazy(() => import('../components/RouteMap'))

const filterRides = (ridesList, searchCriteria) => {
  const fromQuery = (searchCriteria.from || '').toLowerCase().trim();
  const toQuery = (searchCriteria.to || '').toLowerCase().trim();
  const reqSeats = Number(searchCriteria.seats) || 1;

  return ridesList.filter(ride => {
    // Skip cancelled rides
    if (ride.status === 'cancelled') return false;

    // Check available seats
    const availableSeats = Number(ride.availableSeats || ride.seats || 1);
    if (availableSeats < reqSeats) return false;

    // Extract location strings safely
    const depStr = (typeof ride.departure === 'object' ? ride.departure.address : ride.departure || '').toLowerCase();
    const destStr = (typeof ride.destination === 'object' ? ride.destination.address : ride.destination || '').toLowerCase();

    // Partial match: checks if user input (e.g., "Galle") is inside the departure string
    const matchFrom = !fromQuery || depStr.includes(fromQuery) || fromQuery.includes(depStr.split(',')[0].trim());
    const matchTo = !toQuery || destStr.includes(toQuery) || toQuery.includes(destStr.split(',')[0].trim());

    // Date Range Match
    let matchDate = true;
    const rideDateStr = ride.dateTime || ride.departureDate || ride.date;
    if (rideDateStr) {
      const rideDate = new Date(rideDateStr);
      rideDate.setHours(0, 0, 0, 0);

      if (searchCriteria.dateFrom) {
        const fromDate = new Date(searchCriteria.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (rideDate < fromDate) matchDate = false;
      }
      
      if (searchCriteria.dateTo) {
        const toDate = new Date(searchCriteria.dateTo);
        toDate.setHours(0, 0, 0, 0);
        if (rideDate > toDate) matchDate = false;
      }
    }

    return matchFrom && matchTo && matchDate;
  });
};

export default function SearchRide() {
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [seats, setSeats] = useState(1)
  const [rides, setRides] = useState([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const handleSearch = useCallback(async () => {
    setLoading(true)
    setSearched(true)
    try {
      const q = query(collection(db, 'rides'), where('status', '==', 'active'))
      const snap = await getDocs(q)
      const allActiveRides = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      let filteredRides = filterRides(allActiveRides, { from: origin, to: destination, dateFrom, dateTo, seats })

      // Graceful fallback for strict date match (optional)
      if (filteredRides.length === 0 && (dateFrom || dateTo) && (origin || destination)) {
        const flexibleRides = filterRides(allActiveRides, { from: origin, to: destination, seats, dateFrom: null, dateTo: null })
        if (flexibleRides.length > 0) {
          filteredRides = flexibleRides.map(r => ({ ...r, _dateMismatch: true }))
        }
      }

      // Hide rides that have already departed if no date was specified
      if (!dateFrom && !dateTo) {
        const now = new Date()
        filteredRides = filteredRides.filter(r => {
           try {
             const dateStr = r.departureDate || r.date
             const timeStr = r.departureTime || r.departure_time
             if (dateStr && timeStr) {
               const rideDate = new Date(`${dateStr}T${timeStr}:00`)
               if (rideDate < now) return false
             }
           } catch (e) {}
           return true
        })
      }

      setRides(filteredRides)
    } catch (e) {
      console.error(e)
      setRides([])
    } finally {
      setLoading(false)
    }
  }, [origin, destination, dateFrom, dateTo, seats])

  function handleClear() {
    setOrigin('')
    setDestination('')
    setDateFrom('')
    setDateTo('')
    setSeats(1)
    setRides([])
    setSearched(false)
  }

  function swap() {
    setOrigin(destination)
    setDestination(origin)
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Hero section */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-3 leading-tight">
            Find Your <span className="gradient-text">Ride</span>
          </h1>
          <p className="text-slate-500 text-lg max-w-lg">
            Search shared rides across Sri Lanka and split fuel costs with fellow commuters.
          </p>
        </div>
      </div>

      {/* Search form */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-1 pb-8 pt-8">
        <div className="glass-card p-6">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 min-w-0">
              <label htmlFor="origin" className="form-label">From</label>
              <LocationAutocomplete 
                id="origin" 
                name="origin" 
                value={origin} 
                onChange={(e) => setOrigin(e.target.value)} 
                placeholder="Any origin, or tap 📍…" 
                showGpsButton
                onGpsResult={(address) => setOrigin(address)}
              />
            </div>

            {/* Swap button */}
            <button
              onClick={swap}
              type="button"
              className="shrink-0 w-10 h-10 sm:mb-0.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-orange-300 flex items-center justify-center text-slate-400 hover:text-orange-600 transition-all duration-200"
              aria-label="Swap origin and destination"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            </button>

            <div className="flex-1 min-w-0">
              <label htmlFor="destination" className="form-label">To</label>
              <LocationAutocomplete 
                id="destination" 
                name="destination" 
                value={destination} 
                onChange={(e) => setDestination(e.target.value)} 
                placeholder="Any destination" 
              />
            </div>

            {/* Date Range */}
            <div className="flex-1 min-w-0">
              <label htmlFor="dateFrom" className="form-label">Earliest Date</label>
              <input
                id="dateFrom"
                type="date"
                value={dateFrom}
                min={today}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input-field"
              />
            </div>
            
            <div className="flex-1 min-w-0">
              <label htmlFor="dateTo" className="form-label">Latest Date</label>
              <input
                id="dateTo"
                type="date"
                value={dateTo}
                min={dateFrom || today}
                onChange={(e) => setDateTo(e.target.value)}
                className="input-field"
              />
            </div>

            {/* Seats */}
            <div className="w-24 shrink-0">
              <label htmlFor="seats" className="form-label">Seats</label>
              <input
                id="seats"
                type="number"
                min={1}
                max={8}
                value={seats}
                onChange={(e) => setSeats(Math.max(1, parseInt(e.target.value) || 1))}
                className="input-field"
              />
            </div>

            {/* Search button */}
            <button
              onClick={handleSearch}
              disabled={loading}
              className="btn-primary shrink-0 !px-7 sm:mb-0.5"
            >
              {loading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" /></svg>
                  Search
                </span>
              )}
            </button>
          </div>
          
          {/* Route map — always visible below search inputs */}
          <div className="w-full rounded-xl overflow-hidden mt-4" style={{ height: '280px' }}>
            <Suspense fallback={<div className="w-full h-full shimmer" />}>
              <RouteMap 
                origin={origin} 
                destination={destination} 
                height="100%"
                onOriginPicked={(address) => setOrigin(address)}
                onDestinationPicked={(address) => setDestination(address)}
              />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        {!searched && (
          <div className="text-center py-16 text-slate-400">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-40 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
            <p className="text-lg font-semibold text-slate-500">Search for a ride to get started</p>
            <p className="text-sm mt-1 text-slate-400">Enter your origin, destination, and date above</p>
          </div>
        )}

        {searched && loading && (
          <div className="space-y-4 py-8">
            <RideCardSkeleton />
            <RideCardSkeleton />
            <RideCardSkeleton />
          </div>
        )}

        {searched && !loading && rides.length === 0 && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 mx-auto mb-5">
              <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No rides found</h3>
            <p className="text-slate-500 mb-6 max-w-sm mx-auto">
              No rides match your search. Try different dates or cities, or be the first to offer this route!
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={handleClear} className="btn-ghost text-sm">Clear search</button>
              <a href="/offer" className="btn-primary text-sm">Offer a ride</a>
            </div>
          </div>
        )}

        {searched && !loading && rides.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-5">
              <p className="text-slate-600 text-sm">
                <span className="text-slate-900 font-bold">{rides.length}</span> ride{rides.length !== 1 ? 's' : ''} found
              </p>
              <button onClick={handleClear} className="text-xs text-slate-400 hover:text-slate-700 transition-colors font-medium">
                Clear search
              </button>
            </div>
            <div className="grid gap-4">
              {rides.filter(r => r && typeof r === 'object').map((ride) => {
                try {
                  return (
                    <div key={ride.id} className="relative">
                      {ride._dateMismatch && (
                        <div className="absolute -top-3 left-4 z-10 bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-200 shadow-sm">
                          Matches route (different date)
                        </div>
                      )}
                      <RideCard ride={ride} onBooked={handleSearch} />
                    </div>
                  );
                } catch (err) {
                  console.error("Skipping malformed ride document:", ride.id, err);
                  return null;
                }
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
