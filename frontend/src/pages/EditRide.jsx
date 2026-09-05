/**
 * EditRide — Modal/page for drivers to edit their ride details.
 * Route: /edit-ride/:rideId  (or used as a modal from MyRides)
 * Allows editing: date, departure_time, fuel_cost_per_seat, notes, vehicle_description
 * On save: calls PUT /api/rides/:rideId, shows notification count toast.
 */
import { useState, useEffect, lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import toast from 'react-hot-toast'
import FuelCalculator from '../components/FuelCalculator'

const RouteMap = lazy(() => import('../components/RouteMap'))

const SL_CITIES = [
  'Colombo', 'Kandy', 'Galle', 'Negombo', 'Jaffna', 'Trincomalee',
  'Batticaloa', 'Kurunegala', 'Ratnapura', 'Badulla', 'Matara',
  'Anuradhapura', 'Polonnaruwa', 'Nuwara Eliya', 'Hambantota',
  'Ampara', 'Vavuniya', 'Mannar', 'Puttalam', 'Matale',
  'Kegalle', 'Kalutara', 'Gampaha', 'Panadura', 'Moratuwa',
  'Dehiwala', 'Wattala', 'Kaduwela', 'Maharagama', 'Nugegoda',
]

export default function EditRide() {
  const { rideId } = useParams()
  const { user, getToken } = useAuth()
  const navigate = useNavigate()

  const [ride, setRide] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    date: '',
    departure_time: '',
    notes: '',
    vehicle_description: '',
  })
  const [fuelCostPerSeat, setFuelCostPerSeat] = useState(0)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function fetchRide() {
      try {
        const res = await api.get(`/api/rides/${rideId}`)
        const r = res.data
        if (r.driver_uid !== user?.uid) {
          toast.error('You can only edit your own rides')
          navigate('/my-rides')
          return
        }
        setRide(r)
        setForm({
          date: r.date || '',
          departure_time: r.departure_time || '',
          notes: r.notes || '',
          vehicle_description: r.vehicle_description || '',
        })
        setFuelCostPerSeat(r.fuel_cost_per_seat || 0)
      } catch {
        toast.error('Failed to load ride details')
        navigate('/my-rides')
      } finally {
        setLoading(false)
      }
    }
    if (rideId && user) fetchRide()
  }, [rideId, user, navigate])

  function onChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (fuelCostPerSeat <= 0) {
      toast.error('Please set a valid cost per seat using the fuel calculator')
      return
    }

    setSaving(true)
    try {
      const token = await getToken()
      const payload = {
        date: form.date,
        departure_time: form.departure_time,
        fuel_cost_per_seat: parseFloat(fuelCostPerSeat),
        notes: form.notes,
        vehicle_description: form.vehicle_description,
      }
      await api.put(`/api/rides/${rideId}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('Ride updated! Passengers have been notified. ✏️')
      navigate('/my-rides')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to update ride. Please try again.'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <svg className="w-10 h-10 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-12 pb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4 group"
          >
            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to My Rides
          </button>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-2">
            Edit <span className="gradient-text">Ride</span>
          </h1>
          <p className="text-slate-500">
            Update your ride details. All booked passengers will be notified automatically.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

        {/* Route preview (read-only) */}
        {ride && (
          <div className="glass-card p-5 mb-6 animate-slide-up">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Route (fixed)</span>
            </div>
            <div className="flex items-center gap-3 text-slate-800 font-bold text-lg mb-4">
              <span>{ride.origin}</span>
              <svg className="w-4 h-4 text-orange-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span>{ride.destination}</span>
            </div>
            <Suspense fallback={<div className="h-40 shimmer rounded-xl" />}>
              <RouteMap origin={ride.origin} destination={ride.destination} height="160px" />
            </Suspense>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 animate-slide-up stagger-1">

          {/* Date & Time */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="text-orange-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </span>
              Date &amp; Time
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Departure date</label>
                <input
                  type="date"
                  name="date"
                  min={today}
                  value={form.date}
                  onChange={onChange}
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="form-label">Departure time</label>
                <input
                  type="time"
                  name="departure_time"
                  value={form.departure_time}
                  onChange={onChange}
                  required
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Vehicle */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="text-orange-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                </svg>
              </span>
              Vehicle
            </h2>
            <div>
              <label className="form-label">Vehicle description</label>
              <input
                type="text"
                name="vehicle_description"
                value={form.vehicle_description}
                onChange={onChange}
                placeholder="e.g. Toyota Aqua — White, AC, Comfortable"
                maxLength={100}
                className="input-field"
              />
            </div>
          </div>

          {/* Fuel Calculator */}
          <FuelCalculator onCostChange={setFuelCostPerSeat} initialCost={fuelCostPerSeat} />

          {fuelCostPerSeat > 0 && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3.5 animate-fade-in">
              <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-slate-700">
                Passengers will pay <span className="text-slate-900 font-bold">LKR {Math.ceil(fuelCostPerSeat).toLocaleString()}</span> per seat on this ride.
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="glass-card p-6">
            <label className="form-label">Additional notes <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={onChange}
              rows={3}
              maxLength={300}
              placeholder="e.g. Pick-up point, luggage policy, etc."
              className="input-field resize-none"
            />
            <p className="text-xs text-slate-400 mt-1.5 text-right">{form.notes.length}/300</p>
          </div>

          {/* Notification info */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3.5">
            <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-xs text-blue-700">
              All confirmed and pending passengers will be automatically notified of any changes you save.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || fuelCostPerSeat <= 0}
            className="btn-primary w-full py-4 text-base"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving &amp; Notifying Passengers…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                Save Changes
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
