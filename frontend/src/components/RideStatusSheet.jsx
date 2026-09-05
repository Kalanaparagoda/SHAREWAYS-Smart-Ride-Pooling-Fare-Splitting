/**
 * RideStatusSheet — Fixed bottom sheet showing the 4-step ride lifecycle.
 * Listens to the ride document in real-time via Firestore onSnapshot.
 * Passengers see it; drivers also get it with lifecycle control buttons.
 *
 * Props:
 *   rideId: string
 *   isDriver: bool
 *   onAdvance: (nextLifecycle) => void   — called when driver taps Next
 */
import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { doc, onSnapshot } from 'firebase/firestore'

const STEPS = [
  { key: 'heading_to_pickup', label: 'Driver on the Way', shortLabel: 'On the Way', icon: '🚗', color: 'bg-blue-500'  },
  { key: 'at_pickup',         label: 'Arrived at Pickup', shortLabel: 'Arrived',    icon: '📍', color: 'bg-amber-500' },
  { key: 'in_progress',       label: 'Ride in Progress',  shortLabel: 'In Transit', icon: '🛣️', color: 'bg-emerald-500'},
  { key: 'reached',           label: 'Reached Destination',shortLabel: 'Reached',   icon: '🏁', color: 'bg-teal-600'  },
]

const SHEET_BG = {
  heading_to_pickup: 'from-blue-700 to-indigo-800',
  at_pickup:         'from-amber-700 to-orange-800',
  in_progress:       'from-emerald-700 to-teal-800',
  reached:           'from-teal-700 to-slate-800',
}

const NEXT_ACTION = {
  heading_to_pickup: { label: 'Arrived at Pickup', emoji: '📍' },
  at_pickup:         { label: 'Start Ride',        emoji: '🛣️' },
  in_progress:       { label: 'Complete Ride',     emoji: '🏁' },
  reached:           null,
}

const LIFECYCLE_ORDER = ['heading_to_pickup', 'at_pickup', 'in_progress', 'reached']

export default function RideStatusSheet({ rideId, isDriver, onAdvance, className = '' }) {
  const [lifecycle, setLifecycle] = useState('heading_to_pickup')
  const [advancing, setAdvancing] = useState(false)

  useEffect(() => {
    if (!rideId) return
    const unsub = onSnapshot(doc(db, 'rides', rideId), (snap) => {
      if (snap.exists()) {
        setLifecycle(snap.data().tripStatus || 'heading_to_pickup')
      }
    })
    return () => unsub()
  }, [rideId])

  const currentStep = STEPS.find(s => s.key === lifecycle) || STEPS[0]
  const currentIndex = LIFECYCLE_ORDER.indexOf(lifecycle)
  const nextKey = LIFECYCLE_ORDER[currentIndex + 1] || null
  const nextAction = NEXT_ACTION[lifecycle]
  const bgGradient = SHEET_BG[lifecycle] || SHEET_BG.waiting

  async function handleAdvance() {
    if (!nextKey || advancing) return
    setAdvancing(true)
    try {
      await onAdvance(nextKey)
    } finally {
      setAdvancing(false)
    }
  }

  return (
    <div className={`animate-slide-up-sheet ${className}`}>
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-10 h-1 rounded-full bg-white/30" />
      </div>

      {/* Status header */}
      <div className={`bg-gradient-to-r ${bgGradient} px-5 pb-5 transition-all duration-700`}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{currentStep.icon}</span>
          <div>
            <p className="text-white/70 text-xs font-medium uppercase tracking-widest">Ride Status</p>
            <h2 className="text-white text-xl font-bold">{currentStep.label}</h2>
          </div>
        </div>

        {/* 4-step progress bar */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((step, i) => {
            const isDone   = i < currentIndex
            const isCurrent = i === currentIndex
            return (
              <div key={step.key} className="flex-1 flex flex-col items-center gap-1.5">
                <div className={`relative w-full h-1.5 rounded-full transition-all duration-500 ${isDone || isCurrent ? 'bg-white' : 'bg-white/25'}`}>
                  {isCurrent && (
                    <div className="absolute inset-0 rounded-full bg-white animate-pulse" />
                  )}
                </div>
                <span className={`text-[10px] font-semibold transition-colors duration-300 ${isCurrent ? 'text-white' : isDone ? 'text-white/80' : 'text-white/40'}`}>
                  {step.shortLabel}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Driver action button */}
      {isDriver && nextAction && (
        <div className="bg-white px-5 py-4 border-t border-slate-100">
          <button
            onClick={handleAdvance}
            disabled={advancing}
            className="w-full btn-primary py-4 text-base flex items-center justify-center gap-2"
          >
            {advancing ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <>
                <span>{nextAction.emoji}</span>
                {nextAction.label}
              </>
            )}
          </button>
        </div>
      )}

      {/* Completed banner */}
      {lifecycle === 'reached' && (
        <div className="bg-emerald-50 border-t border-emerald-100 px-5 py-4 text-center">
          <p className="text-emerald-700 font-semibold text-sm">🎉 Ride completed! Thank you for sharing.</p>
        </div>
      )}
    </div>
  )
}
