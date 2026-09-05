import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import toast from 'react-hot-toast'
import StarRating from './StarRating'

export default function RatingWidget({ booking, onRated }) {
  const { getToken } = useAuth()
  const [rating, setRating] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(booking.rated || false)

  if (done) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        You rated this driver
      </div>
    )
  }

  async function handleSubmit() {
    if (rating === 0) return toast.error('Please select a star rating')
    setSubmitting(true)
    try {
      const token = await getToken()
      await api.post(`/api/auth/rate/${booking.driver_uid}`, {
        booking_id: booking.id,
        rating,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setDone(true)
      toast.success(`⭐ Thanks for rating ${booking.driver_name}!`)
      onRated?.()
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to submit rating'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pt-3 border-t border-slate-100">
      <p className="text-xs font-semibold text-slate-500 mb-2">Rate your driver</p>
      <div className="flex items-center gap-3">
        <StarRating value={rating} onChange={setRating} size="md" />
        <button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="text-xs bg-orange-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit Rating'}
        </button>
      </div>
    </div>
  )
}
