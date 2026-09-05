/**
 * RideLobby — Shows co-passengers for a confirmed booking.
 * Privacy-safe: Only first name, avatar initial, and pickup point are shown.
 * Listens in real-time to bookings for the same ride_id via Firestore onSnapshot.
 *
 * Props:
 *   rideId: string
 *   myUid: string    — current user's UID so we exclude them from the list
 */
import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-sky-500', 'bg-teal-500',
  'bg-pink-500', 'bg-indigo-500', 'bg-rose-500',
]

function getColor(name) {
  let hash = 0
  for (const ch of (name || '')) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export default function RideLobby({ rideId, myUid }) {
  const [coPassengers, setCoPassengers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!rideId) return
    const q = query(
      collection(db, 'bookings'),
      where('ride_id', '==', rideId),
      where('status', '==', 'confirmed'),
    )
    const unsub = onSnapshot(q, (snap) => {
      const others = []
      snap.forEach(d => {
        const data = d.data()
        if (data.passenger_uid !== myUid) {
          others.push({
            id: d.id,
            firstName: (data.passenger_name || 'Passenger').split(' ')[0],
            pickup: data.pickup_point || data.origin || 'N/A',
            seats: data.seats_requested || 1,
          })
        }
      })
      setCoPassengers(others)
      setLoading(false)
    })
    return () => unsub()
  }, [rideId, myUid])

  if (loading) {
    return (
      <div className="mt-4 animate-pulse">
        <div className="h-4 w-32 bg-slate-200 rounded mb-3" />
        <div className="flex gap-3">
          {[1, 2].map(i => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-slate-200" />
              <div className="h-3 w-12 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (coPassengers.length === 0) {
    return (
      <div className="mt-4 bg-slate-50 rounded-xl border border-slate-200 p-4 text-center">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Who's Riding With You</p>
        <p className="text-sm text-slate-400">You're the only passenger so far. Share the ride to reduce your fare!</p>
      </div>
    )
  }

  return (
    <div className="mt-4 animate-fade-in">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span>👥</span>
        Who's Riding With You
        <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
          {coPassengers.length}
        </span>
      </p>
      <div className="flex flex-wrap gap-3">
        {coPassengers.map(p => (
          <div
            key={p.id}
            className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm hover:border-orange-200 transition-colors"
          >
            <div className={`${getColor(p.firstName)} w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0`}>
              {p.firstName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{p.firstName}</p>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {p.pickup}
              </p>
              {p.seats > 1 && (
                <p className="text-xs text-slate-400">{p.seats} seats</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
