import { useState, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import toast from 'react-hot-toast'

/**
 * SOS Emergency Button
 *
 * A floating, always-visible red button shown during active rides.
 * When tapped:
 *   1. Gets the user's current GPS location (best-effort)
 *   2. Sends a POST /api/auth/sos/alert to the backend
 *   3. Backend FCM-pushes to the emergency contact (if they're on ShareWays)
 *   4. Shows a confirmation toast with a Google Maps link to share manually
 *
 * If no emergency contact is set, prompts the user to add one in Profile.
 */
export default function SosButton() {
  const { getToken } = useAuth()
  const [state, setState] = useState('idle') // 'idle' | 'locating' | 'sending' | 'sent'
  const [showConfirm, setShowConfirm] = useState(false)

  const getLocation = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null)
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      )
    })

  const handleSos = useCallback(async () => {
    if (state === 'sending' || state === 'sent') return

    setState('locating')
    let coords = null
    try {
      coords = await getLocation()
    } catch {
      coords = null
    }

    setState('sending')
    try {
      const token = await getToken()
      const res = await api.post(
        '/api/auth/sos/alert',
        {
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          message: null, // backend generates default message
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setState('sent')
      setShowConfirm(false)

      const locUrl = res.data.location_url
      toast.custom(
        (t) => (
          <div className={`bg-red-700 text-white px-5 py-4 rounded-2xl shadow-2xl max-w-sm flex flex-col gap-2 ${t.visible ? 'animate-fade-in' : 'opacity-0'}`}>
            <div className="flex items-center gap-2 font-bold text-lg">
              <span>🆘</span> SOS Alert Sent!
            </div>
            <p className="text-sm text-red-100">
              Your emergency contact has been notified.
              {locUrl ? ' They can see your live location.' : ''}
            </p>
            {locUrl && (
              <a
                href={locUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline text-red-200 mt-1"
              >
                📍 Share this location link manually
              </a>
            )}
          </div>
        ),
        { duration: 10000 }
      )

      // Reset after 30 seconds so user can trigger again if needed
      setTimeout(() => setState('idle'), 30000)
    } catch (err) {
      setState('idle')
      const detail = err.response?.data?.detail || 'Failed to send SOS alert.'
      if (detail.includes('No emergency contact')) {
        toast.error(
          '⚠️ No emergency contact set! Please add one in your Profile → Emergency Contact.',
          { duration: 8000 }
        )
      } else {
        toast.error(detail)
      }
    }
  }, [state, getToken])

  const buttonLabel = {
    idle: 'SOS',
    locating: '...',
    sending: '...',
    sent: '✓',
  }[state]

  const isLoading = state === 'locating' || state === 'sending'

  return (
    <>
      {/* Floating SOS button */}
      <button
        id="sos-button"
        type="button"
        onClick={() => {
          if (state === 'idle') setShowConfirm(true)
        }}
        disabled={isLoading || state === 'sent'}
        aria-label="SOS Emergency Button"
        className={`
          fixed bottom-36 right-4 z-50
          w-14 h-14 rounded-full
          flex items-center justify-center
          font-extrabold text-sm text-white
          shadow-2xl transition-all duration-200 select-none
          ${state === 'sent'
            ? 'bg-emerald-600 scale-90'
            : 'bg-red-600 hover:bg-red-700 active:scale-95 sos-pulse'}
          ${isLoading ? 'opacity-75 cursor-wait' : ''}
        `}
      >
        {isLoading ? (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <span>{buttonLabel}</span>
        )}
      </button>

      {/* Confirmation dialog overlay */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl shrink-0">
                🆘
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Send SOS Alert?</h2>
                <p className="text-sm text-slate-500">
                  Your emergency contact will be notified with your location.
                </p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-800">
              This will immediately alert your emergency contact via push notification and in-app message.
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false)
                  handleSos()
                }}
                className="flex-[2] py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Send SOS Now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
