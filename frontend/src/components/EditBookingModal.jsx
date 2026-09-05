import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import toast from 'react-hot-toast'

export default function EditBookingModal({ booking, onClose, onUpdated }) {
  const { getToken } = useAuth()
  
  // Can only edit seats if pending
  const isPending = booking.status === 'pending'
  
  const [seats, setSeats] = useState(booking.seats_requested || 1)
  const [pickup, setPickup] = useState(booking.pickup_point || '')
  const [notes, setNotes] = useState(booking.notes || '')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const token = await getToken()
      const payload = {
        pickup_point: pickup,
        notes: notes
      }
      if (isPending) {
        payload.seats_requested = parseInt(seats, 10)
      }
      
      await api.put(`/api/bookings/${booking.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      })
      toast.success('Booking updated successfully!')
      onUpdated()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update booking')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Edit Booking</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Seats Requested</label>
            {isPending ? (
              <select
                value={seats}
                onChange={e => setSeats(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
              >
                {[1, 2, 3, 4].map(num => (
                  <option key={num} value={num}>{num} {num === 1 ? 'seat' : 'seats'}</option>
                ))}
              </select>
            ) : (
              <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-500">
                {booking.seats_requested} {booking.seats_requested === 1 ? 'seat' : 'seats'} 
                <span className="text-xs ml-2 italic">(Cannot change seats for confirmed bookings)</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Pickup Point</label>
            <input
              type="text"
              value={pickup}
              onChange={e => setPickup(e.target.value)}
              placeholder={booking.origin || 'Where should the driver pick you up?'}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Notes for Driver (Optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. I have a large suitcase"
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
