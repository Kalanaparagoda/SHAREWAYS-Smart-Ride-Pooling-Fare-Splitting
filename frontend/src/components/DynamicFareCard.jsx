/**
 * DynamicFareCard — Displays a booking's real-time fare.
 * Listens to the booking document in Firestore.
 * Flashes green when fare drops (new passenger joined) and red when it rises (cancellation).
 *
 * Props:
 *   bookingId: string
 *   initialFare: number
 *   seatsRequested: number
 */
import { useState, useEffect, useRef } from 'react'
import { db } from '../firebase'
import { doc, onSnapshot } from 'firebase/firestore'

export default function DynamicFareCard({ bookingId, initialFare, seatsRequested }) {
  const [fare, setFare] = useState(initialFare)
  const [sharedPerSeat, setSharedPerSeat] = useState(null)
  const [flashClass, setFlashClass] = useState('')
  const prevFare = useRef(initialFare)

  useEffect(() => {
    if (!bookingId) return
    const unsub = onSnapshot(doc(db, 'bookings', bookingId), (snap) => {
      if (!snap.exists()) return
      const data = snap.data()
      const newFare = data.total_cost ?? initialFare
      const newShared = data.shared_cost_per_seat ?? null

      if (Math.abs(newFare - prevFare.current) > 0.5) {
        const dropped = newFare < prevFare.current
        setFlashClass(dropped ? 'fare-flash-green' : 'fare-flash-red')
        // Clear after animation
        setTimeout(() => setFlashClass(''), 1400)
      }
      prevFare.current = newFare
      setFare(newFare)
      setSharedPerSeat(newShared)
    })
    return () => unsub()
  }, [bookingId, initialFare])

  const dropped = fare < initialFare
  const increased = fare > initialFare

  return (
    <div className={`rounded-xl border transition-all duration-300 p-4 ${flashClass} ${
      dropped ? 'border-emerald-200 bg-emerald-50' :
      increased ? 'border-red-200 bg-red-50' :
      'border-slate-200 bg-white'
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-0.5">Your Fare</p>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-extrabold transition-colors duration-500 ${
              dropped ? 'text-emerald-700' : increased ? 'text-red-600' : 'text-slate-900'
            }`}>
              LKR {Math.round(fare).toLocaleString()}
            </span>
            {seatsRequested > 1 && (
              <span className="text-xs text-slate-400">for {seatsRequested} seats</span>
            )}
          </div>
          {sharedPerSeat && (
            <p className="text-xs text-slate-400 mt-0.5">
              LKR {Math.round(sharedPerSeat).toLocaleString()}/seat (shared)
            </p>
          )}
        </div>

        <div className="text-right">
          {dropped && (
            <div className="flex items-center gap-1 text-emerald-600 font-semibold text-sm animate-fade-in">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
              Fare dropped!
            </div>
          )}
          {increased && (
            <div className="flex items-center gap-1 text-red-500 font-semibold text-sm animate-fade-in">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Fare updated
            </div>
          )}
          {!dropped && !increased && (
            <div className="text-slate-300">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Split info note */}
      <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100/80">
        💡 Fare is split dynamically among confirmed passengers
      </p>
    </div>
  )
}
