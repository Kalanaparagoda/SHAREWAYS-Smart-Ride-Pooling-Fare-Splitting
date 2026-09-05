import { useState, useEffect, useRef, lazy, Suspense } from 'react'

// Create a ref to control the RouteMap (set pins, pan, etc.)
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import FuelCalculator from '../components/FuelCalculator'
import LocationAutocomplete from '../components/LocationAutocomplete'
import { collection, addDoc, serverTimestamp, doc, getDoc, writeBatch, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import toast from 'react-hot-toast'

// Lazy-load the map so it only adds to bundle when origin+destination are chosen
const RouteMap = lazy(() => import('../components/RouteMap'))

export default function OfferRide() {
  const { user, getToken } = useAuth()
  const navigate = useNavigate()
  const mapRef = useRef(null);

  const [form, setForm] = useState({
    date: '',
    departure_time: '',
    total_seats: 1,
    vehicle_category: '',
    fuel_type: 'Petrol',
    includes_toll: false,
    gender_preference: 'Co-ed Friendly',
    notes: '',
    plate_number: '',
    vehicle_make: '',
    vehicle_model: '',
    transmission: 'Auto',
    acAvailable: false,
    luggageOk: false,
    noSmoking: false,
  })
  const [departureLocation, setDepartureLocation] = useState({ address: '', lat: null, lng: null })
  const [destinationLocation, setDestinationLocation] = useState({ address: '', lat: null, lng: null })
  const [fuelCostPerSeat, setFuelCostPerSeat] = useState(0)
  const [calculatedDistance, setCalculatedDistance] = useState(0)
  const [loading, setLoading] = useState(false)

  const [isRecurring, setIsRecurring] = useState(false)
  const [endDate, setEndDate] = useState('')
  const [selectedDays, setSelectedDays] = useState([])

  const today = new Date().toISOString().split('T')[0]

  const [userProfile, setUserProfile] = useState(null)

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserProfile(data);
        setForm(f => ({
          ...f,
          vehicle_category: f.vehicle_category || data.vehicleMake || data.vehicle_make || '',
          plate_number: data.plateNumber || data.plate_number || '',
          vehicle_make: data.vehicleMake || data.vehicle_make || '',
          vehicle_model: data.vehicleModel || data.vehicle_model || '',
          transmission: data.transmission || 'Auto',
          driver_photo: data.profilePhotoUrl || ''
        }));
      }
    });
    return unsubscribe;
  }, [user]);

  function onChange(e) {
    const { name, value, type, checked } = e.target;
    let newValue = type === 'checkbox' ? checked : value;
    
    setForm((f) => {
      const updated = { ...f, [name]: newValue };
      if (name === 'vehicle_category' || name === 'acAvailable' || name === 'luggageOk') {
        const cat = name === 'vehicle_category' ? newValue : f.vehicle_category;
        if (cat === 'bike' || cat === 'tuktuk') {
          updated.includes_toll = false;
          updated.acAvailable = false;
        }
        if (cat === 'bike') {
          updated.luggageOk = false;
        }
      }
      return updated;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!user) {
      toast.error('Please log in to offer a ride')
      navigate('/login')
      return
    }

    if (!departureLocation.address || !destinationLocation.address) {
      toast.error('Please select origin and destination')
      return
    }
    if (departureLocation.address === destinationLocation.address) {
      toast.error('Origin and destination cannot be the same')
      return
    }
    if (!form.date) {
      toast.error('Please select a departure date')
      return
    }
    if (isRecurring) {
      if (!endDate) {
        toast.error('Please select an end date for recurring rides');
        return;
      }
      if (selectedDays.length === 0) {
        toast.error('Please select at least one day for recurring rides');
        return;
      }
      const start = new Date(form.date);
      const end = new Date(endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      if (diffDays > 30) {
        toast.error('Recurring rides can only be scheduled up to 30 days in advance');
        return;
      }
      if (end < start) {
        toast.error('End date must be after departure date');
        return;
      }
    }
    if (!departureLocation.lat || !destinationLocation.lat) {
      toast.error('Please pick pickup and dropoff points on the map')
      return
    }
    if (fuelCostPerSeat <= 0) {
      toast.error('Fuel cost per seat must be calculated')
      return
    }
    if (form.total_seats < 1) {
      toast.error('Please specify at least one passenger seat')
      return
    }
    if (!form.departure_time) {
      toast.error('Please select a departure time')
      return
    }
    if (!form.vehicle_category) {
      toast.error('Please select a vehicle category')
      return
    }
    if (!form.vehicle_description.trim()) {
      toast.error('Please describe your vehicle')
      return
    }

    setLoading(true)
    try {
      const newRide = {
        departure: departureLocation,
        destination: destinationLocation,
        departureDate: form.date,
        departureTime: form.departure_time,
        vehicleType: form.vehicle_category,
        fuelType: form.fuel_type,
        includesToll: (form.vehicle_category === 'bike' || form.vehicle_category === 'tuktuk') ? false : form.includes_toll,
        genderPreference: form.gender_preference,
        availableSeats: Number(form.total_seats),
        pricePerSeat: Number(fuelCostPerSeat) + ((form.includes_toll && form.vehicle_category !== 'bike' && form.vehicle_category !== 'tuktuk') ? 100 : 0),
        totalCost: Number(form.total_seats) * (Number(fuelCostPerSeat) + ((form.includes_toll && form.vehicle_category !== 'bike' && form.vehicle_category !== 'tuktuk') ? 100 : 0)),
        route_distance_km: calculatedDistance,
        notes: form.notes || '',
        driver_uid: user?.uid || 'user',
        driver_name: user?.displayName || 'User',
        driver_email: user?.email || '',
        driver_photo: form.driver_photo || '',
        plate_number: form.plate_number,
        vehicle_make: form.vehicle_make,
        vehicle_model: form.vehicle_model,
        transmission: form.transmission,
        acAvailable: (form.vehicle_category === 'bike' || form.vehicle_category === 'tuktuk') ? false : form.acAvailable,
        luggageOk: (form.vehicle_category === 'bike') ? false : form.luggageOk,
        noSmoking: form.noSmoking,
        status: 'active',
        createdAt: serverTimestamp()
      }

      if (isRecurring) {
        const batch = writeBatch(db);
        const start = new Date(form.date);
        const end = new Date(endDate);
        let current = new Date(start);
        let createdCount = 0;
        const groupId = `group_${Date.now()}`;
        
        while (current <= end) {
          if (selectedDays.includes(current.getDay())) {
            const dateStr = current.toISOString().split('T')[0];
            const rideRef = doc(collection(db, 'rides'));
            batch.set(rideRef, {
              ...newRide,
              departureDate: dateStr,
              groupId: groupId
            });
            createdCount++;
          }
          current.setDate(current.getDate() + 1);
        }

        if (createdCount === 0) {
          toast.error('No matching days found in the selected date range');
          setLoading(false);
          return;
        }

        await batch.commit();
        toast.success(`Successfully posted ${createdCount} recurring rides! 🚗`);
      } else {
        await addDoc(collection(db, 'rides'), newRide)
        toast.success('Ride posted successfully! 🚗')
      }
      
      navigate('/my-rides')
    } catch (err) {
      console.error('Post ride error:', err)
      const msg = err.message || 'Failed to post ride. Please try again.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  function SectionHeader({ icon, title }) {
    return (
      <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-100">
        <span className="text-orange-600">{icon}</span>
        {title}
      </h2>
    )
  }

  const activeRole = localStorage.getItem('userMode') || localStorage.getItem('activeRole') || userProfile?.role || user?.mode || user?.role;
  const isDriverAllowed = 
    activeRole?.toLowerCase() === 'driver' || 
    user?.isDriver === true || 
    userProfile?.role?.toLowerCase() === 'driver' ||
    user?.role?.toLowerCase() === 'driver';

  async function handleSwitchToDriver() {
    if (!user?.uid) return;
    try {
      import('firebase/firestore').then(({ updateDoc }) => {
        updateDoc(doc(db, 'users', user.uid), { role: 'driver' });
      });
      localStorage.setItem('activeRole', 'driver');
      toast.success('Switched to Driver Mode!');
    } catch (err) {
      toast.error('Failed to switch mode');
    }
  }
  if (!isDriverAllowed) {
    return (
      <div className="min-h-screen bg-slate-50 pt-20">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white border border-red-200 rounded-2xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Driver Access Required</h2>
            <p className="text-slate-500 mb-6">
              You are currently signed in as a Passenger. Only registered drivers can publish rides.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={handleSwitchToDriver} className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors">
                Switch to Driver Mode
              </button>
              <button onClick={() => navigate('/search')} className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold py-3 px-6 rounded-xl transition-colors">
                Find a Ride
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Page header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-12 pb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-2">
            Offer a <span className="gradient-text">Ride</span>
          </h1>
          <p className="text-slate-500">Share your journey and split fuel costs with fellow commuters.</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <form onSubmit={handleSubmit} className="space-y-6 animate-slide-up">

          {/* Route section */}
          <div className="glass-card p-6 space-y-4">
            <SectionHeader
              title="Route"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              }
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="origin" className="form-label">Departure location</label>
                                <LocationAutocomplete
                  id="origin"
                  name="origin"
                  value={departureLocation.address || ''}
                  onChange={(e) => setDepartureLocation(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter address, or tap 📍 below…"
                  required
                  showGpsButton
                  onGpsResult={(address, lat, lng) => {
                    setDepartureLocation({ address, lat, lng })
                  }}
                  onPlaceSelected={(place) => {
                    const addr = place.display_name.split(',').slice(0, 3).join(', ').trim()
                    setDepartureLocation({ address: addr, lat: Number(place.lat), lng: Number(place.lng) })
                    if (mapRef?.current?.setOriginPin) {
                      mapRef.current.setOriginPin({ lat: Number(place.lat), lng: Number(place.lng) })
                      mapRef.current.panTo(place.lat, place.lng)
                    }
                  }}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="destination" className="form-label">Destination location</label>
                <LocationAutocomplete
                  id="destination"
                  name="destination"
                  value={destinationLocation.address || ''}
                  onChange={(e) => setDestinationLocation(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter specific address or city…"
                  required
                  onGpsResult={(address, lat, lng) => {
                    setDestinationLocation({ address, lat, lng })
                  }}
                  onPlaceSelected={(place) => {
                    const addr = place.display_name.split(',').slice(0, 3).join(', ').trim()
                    setDestinationLocation({ address: addr, lat: Number(place.lat), lng: Number(place.lng) })
                    if (mapRef?.current?.setDestinationPin) {
                      mapRef.current.setDestinationPin({ lat: Number(place.lat), lng: Number(place.lng) })
                      mapRef.current.panTo(place.lat, place.lng)
                    }
                  }}
                />
              </div>
            </div>

            {/* Route map — always visible, center on Sri Lanka by default */}
            <div className="w-full rounded-xl overflow-hidden mt-2" style={{ height: '280px' }}>
              <Suspense fallback={<div className="w-full h-full shimmer" />}>
                <RouteMap
                  ref={mapRef}
                  departure={departureLocation}
                  destination={destinationLocation}
                  height="100%"
                  onRouteCalculated={setCalculatedDistance}
                  onDepartureUpdate={setDepartureLocation}
                  onDestinationUpdate={setDestinationLocation}
                />
              </Suspense>
            </div>
            {departureLocation.address && destinationLocation.address && calculatedDistance > 0 && (
              <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5 mt-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                Exact driving distance: {Math.round(calculatedDistance)} km — auto-filled in calculator below
              </p>
            )}
          </div>

          {/* Date & Time section */}
          <div className="glass-card p-6 space-y-4">
            <SectionHeader
              title="Date &amp; Time"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
              }
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="date" className="form-label">Departure date</label>
                <input
                  id="date"
                  name="date"
                  type="date"
                  min={today}
                  value={form.date}
                  onChange={onChange}
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="departure_time" className="form-label">Departure time</label>
                <input
                  id="departure_time"
                  name="departure_time"
                  type="time"
                  value={form.departure_time}
                  onChange={onChange}
                  required
                  className="input-field"
                />
              </div>
            </div>
            
            {/* Recurring rides */}
            <div className="mt-4 border-t border-slate-100 pt-4">
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                />
                <span className="text-sm font-semibold text-slate-800">Make this a recurring ride</span>
              </label>
              
              {isRecurring && (
                <div className="space-y-4 animate-fade-in pl-6 border-l-2 border-orange-200">
                  <div>
                    <label className="form-label">End date (Max 30 days)</label>
                    <input
                      type="date"
                      min={form.date || today}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="input-field max-w-xs"
                    />
                  </div>
                  <div>
                    <label className="form-label mb-2">Repeat on</label>
                    <div className="flex flex-wrap gap-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                        const isSelected = selectedDays.includes(idx);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              setSelectedDays(prev => 
                                prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
                              )
                            }}
                            className={`w-10 h-10 rounded-full text-xs font-bold transition-all ${
                              isSelected 
                                ? 'bg-orange-600 text-white shadow-md' 
                                : 'bg-slate-100 text-slate-500 hover:bg-orange-50'
                            }`}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Vehicle & Seats */}
          <div className="glass-card p-6 space-y-4">
            <SectionHeader
              title="Vehicle &amp; Seats"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
              }
            />
            <div className="grid sm:grid-cols-2 gap-4">
            {/* Vehicle Category */}
            <div className="sm:col-span-2">
              <label className="form-label">Vehicle category</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {[
                  { value: 'car', label: 'Car', emoji: '🚗' },
                  { value: 'van', label: 'Van', emoji: '🚐' },
                  { value: 'bike', label: 'Bike', emoji: '🏍️' },
                  { value: 'tuktuk', label: 'Tuk-Tuk', emoji: '🛺' },
                ].map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => {
                      setForm(f => ({
                        ...f,
                        vehicle_category: cat.value,
                        acAvailable: cat.value === 'bike' || cat.value === 'tuktuk' ? false : f.acAvailable,
                        luggageOk: cat.value === 'bike' ? false : f.luggageOk,
                        includes_toll: cat.value === 'bike' || cat.value === 'tuktuk' ? false : f.includes_toll,
                        total_seats: Math.min(f.total_seats, {
                          bike: 1,
                          tuktuk: 2,
                          car: 4,
                          van: 8,
                        }[cat.value] || 8),
                      }))
                    }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                      form.vehicle_category === cat.value
                        ? 'bg-orange-600 text-white border-orange-600 shadow-sm shadow-orange-200'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-600'
                    }`}
                  >
                    <span>{cat.emoji}</span> {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vehicle Description */}
            <div className="sm:col-span-2">
              <label htmlFor="vehicle_description" className="form-label">Vehicle description</label>
                <input
                  id="vehicle_description"
                  name="vehicle_description"
                  type="text"
                  value={form.vehicle_description}
                  onChange={onChange}
                  placeholder="e.g. Toyota Aqua — White, AC, Comfortable"
                  maxLength={100}
                  required
                  className="input-field"
                />
              </div>

            {/* Fuel Type */}
            <div className="sm:col-span-2">
              <label htmlFor="fuel_type" className="form-label">Fuel Type</label>
              <select
                id="fuel_type"
                name="fuel_type"
                value={form.fuel_type}
                onChange={onChange}
                className="input-field mt-1"
              >
                <option value="Petrol">Petrol</option>
                <option value="Diesel">Diesel</option>
                <option value="Full Electric (EV)">Full Electric (EV)</option>
              </select>
            </div>

            {/* Gender Preference */}
            <div className="sm:col-span-2">
              <label className="form-label">Ride Environment / Passenger Preference</label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gender_preference"
                    value="Co-ed Friendly"
                    checked={form.gender_preference === 'Co-ed Friendly'}
                    onChange={onChange}
                    className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Co-ed Friendly (Anyone)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gender_preference"
                    value="Ladies Only"
                    checked={form.gender_preference === 'Ladies Only'}
                    onChange={onChange}
                    className="w-4 h-4 text-pink-500 focus:ring-pink-400"
                  />
                  <span className="text-sm font-medium text-slate-700">Ladies Only 👩</span>
                </label>
              </div>
            </div>

            {/* Ride Amenities */}
            <div className="sm:col-span-2">
              <label className="form-label">Ride Amenities (Optional)</label>
              <div className="flex flex-wrap gap-4 mt-2">
                {form.vehicle_category !== 'bike' && form.vehicle_category !== 'tuktuk' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="acAvailable"
                      checked={form.acAvailable}
                      onChange={onChange}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm font-medium text-slate-700">AC Available ❄️</span>
                  </label>
                )}
                {form.vehicle_category !== 'bike' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="luggageOk"
                      checked={form.luggageOk}
                      onChange={onChange}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Luggage OK 🧳</span>
                  </label>
                )}
                {form.vehicle_category === 'bike' && (
                  <label className="flex items-center gap-2 cursor-pointer opacity-70">
                    <input
                      type="checkbox"
                      checked={true}
                      readOnly
                      className="w-4 h-4 text-slate-400 rounded"
                    />
                    <span className="text-sm font-medium text-slate-500">Helmet Provided 🪖</span>
                  </label>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="noSmoking"
                    checked={form.noSmoking}
                    onChange={onChange}
                    className="w-4 h-4 text-red-500 rounded focus:ring-red-400"
                  />
                  <span className="text-sm font-medium text-slate-700">No Smoking 🚭</span>
                </label>
              </div>
            </div>

              <div>
                <label htmlFor="total_seats" className="form-label">Available seats for passengers</label>
                <div className="flex items-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, total_seats: Math.max(1, f.total_seats - 1) }))}
                    disabled={form.total_seats <= 1}
                    className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 transition-colors flex items-center justify-center text-lg font-bold shrink-0"
                  >−</button>
                  <span className="text-2xl font-bold text-slate-900 w-8 text-center">{form.total_seats}</span>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, total_seats: Math.min(
                      {
                        bike: 1,
                        tuktuk: 2,
                        car: 4,
                        van: 8,
                      }[f.vehicle_category] || 8,
                      f.total_seats + 1,
                   ) }))}
                    disabled={form.total_seats >= ({ bike: 1, tuktuk: 2, car: 4, van: 8 }[form.vehicle_category] || 8)}
                    className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 transition-colors flex items-center justify-center text-lg font-bold shrink-0"
                  >+</button>                  <span className="text-slate-400 text-sm">seat{form.total_seats !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Fuel Calculator */}
          <FuelCalculator onCostChange={setFuelCostPerSeat} autoDistance={calculatedDistance} fuelType={form.fuel_type} passengers={form.total_seats} />

          {/* Cost preview */}
          {fuelCostPerSeat > 0 && (
            <div className="flex flex-col gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-sm text-slate-700">
                  Passengers will pay <span className="text-slate-900 font-bold">LKR {(fuelCostPerSeat + ((form.includes_toll && form.vehicle_category !== 'bike' && form.vehicle_category !== 'tuktuk') ? 100 : 0)).toLocaleString()}</span> per seat on this ride.
                </p>
              </div>
              
              {form.vehicle_category !== 'bike' && form.vehicle_category !== 'tuktuk' && (
                <label className="flex items-center justify-between p-3.5 bg-white border border-emerald-200 rounded-xl cursor-pointer hover:bg-emerald-50/40 transition">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      name="includes_toll"
                      checked={form.includes_toll}
                      onChange={onChange}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="text-sm font-semibold text-slate-800">Use Expressway / Highway</span>
                      <p className="text-xs text-slate-500">Shared expressway toll charge (+LKR 100 per passenger)</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md">
                    +LKR 100 / seat
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="glass-card p-6">
            <label htmlFor="notes" className="form-label">Additional notes <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea
              id="notes"
              name="notes"
              value={form.notes}
              onChange={onChange}
              rows={3}
              maxLength={300}
              placeholder="e.g. Pick-up point: Colombo Fort station entrance. No smoking. Luggage ok."
              className="input-field resize-none"
            />
            <p className="text-xs text-slate-400 mt-1.5 text-right">{form.notes.length}/300</p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || fuelCostPerSeat <= 0}
            className="btn-primary w-full py-4 text-base"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Posting ride…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Post ride
              </span>
            )}
          </button>

          {fuelCostPerSeat <= 0 && (
            <p className="text-center text-xs text-slate-400">
              ⚠️ Use the Fuel Calculator above to set the cost per seat before posting
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
