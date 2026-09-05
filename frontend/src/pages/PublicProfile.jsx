/**
 * PublicProfile — Read-only public profile view.
 * Route: /profile/:uid
 * Shows: name, avatar, join date, average star rating, total ratings.
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import StarRating from '../components/StarRating'

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-5">
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full shimmer" />
            <div className="w-40 h-6 rounded-xl shimmer" />
            <div className="w-28 h-4 rounded-xl shimmer" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-20 rounded-xl shimmer" />
            <div className="h-20 rounded-xl shimmer" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PublicProfile() {
  const { uid } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await api.get(`/api/auth/profile/${uid}`)
        setProfile(res.data)
      } catch (err) {
        if (err.response?.status === 404) {
          setError('User not found')
        } else {
          setError('Failed to load profile')
        }
      } finally {
        setLoading(false)
      }
    }
    if (uid) fetchProfile()
  }, [uid])

  if (loading) return <ProfileSkeleton />

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">{error}</h3>
          <p className="text-slate-500 text-sm mb-5">The profile you're looking for doesn't exist.</p>
          <button onClick={() => navigate(-1)} className="btn-ghost text-sm">
            Go back
          </button>
        </div>
      </div>
    )
  }

  const initials = (profile.display_name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const joinedDate = profile.joined_at
    ? new Date(profile.joined_at).toLocaleDateString('en-LK', { month: 'long', year: 'numeric' })
    : 'ShareWays Member'

  const avgRating = profile.average_rating
  const totalRatings = profile.total_ratings || 0

  const hasVehicle = profile.vehicle_make || profile.vehicle_model || profile.plate_number;
  
  // Format plate number (WP CAS-12••)
  const formatPlate = (plate) => {
    if (!plate) return 'Unknown Plate';
    if (plate.length <= 2) return plate;
    return plate.slice(0, -2) + '••';
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-md mx-auto animate-slide-up">

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-6 group"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>

        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header banner */}
          <div className="h-28 bg-gradient-to-br from-orange-500 to-orange-600 relative">
            <div className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px), radial-gradient(circle at 70% 20%, white 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
          </div>

          <div className="px-8 pb-8">
            {/* Avatar */}
            <div className="flex justify-between items-end -mt-12 mb-6">
              <div className="w-20 h-20 rounded-full bg-white border-4 border-white shadow-md flex items-center justify-center text-orange-600 font-extrabold text-2xl overflow-hidden">
                {profile.profilePhotoUrl ? (
                  <img src={profile.profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-1 ${profile.role === 'driver' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                {profile.role === 'driver' ? (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Verified Driver
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0-2a3 3 0 110-6 3 3 0 010 6zm9 11a1 1 0 01-2 0c0-2.76-2.24-5-5-5h-4c-2.76 0-5 2.24-5 5a1 1 0 01-2 0c0-3.86 3.14-7 7-7h4c3.86 0 7 3.14 7 7z" /></svg>
                    Passenger
                  </>
                )}
              </span>
            </div>

            {/* Name */}
            <h1 className="text-2xl font-extrabold text-slate-900 mb-1">
              {profile.display_name || 'ShareWays User'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${profile.gender === 'Female' ? 'bg-pink-50 text-pink-600 border border-pink-200' : 'bg-slate-100 text-slate-600'}`}>
                {profile.gender || 'Not specified'}
              </span>
              {profile.phone && (
                <span className="text-sm text-slate-600 font-medium">{profile.phone}</span>
              )}
            </div>
            {profile.emergency_contact?.phone && (
              <div className="text-xs text-red-600 mb-6 bg-red-50 inline-block px-2 py-1 rounded border border-red-200 font-medium">
                🆘 Emergency: {profile.emergency_contact.name || 'Contact'} ({profile.emergency_contact.phone})
              </div>
            )}
            {!profile.emergency_contact?.phone && (
               <p className="text-sm text-slate-400 mb-6">Member since {joinedDate}</p>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Rating card */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500 font-medium mb-2">Driver Rating</p>
                {avgRating !== null && avgRating !== undefined ? (
                  <>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-2xl font-extrabold text-slate-900">
                        {avgRating.toFixed(1)}
                      </span>
                      <span className="text-slate-400 text-sm">/ 5</span>
                    </div>
                    <StarRating value={avgRating} readonly size="sm" />
                    <p className="text-xs text-slate-400 mt-1.5">
                      {totalRatings} rating{totalRatings !== 1 ? 's' : ''}
                    </p>
                  </>
                ) : (
                  <div>
                    <div className="flex gap-0.5 mb-1">
                      {[1,2,3,4,5].map(i => (
                        <svg key={i} className="w-4 h-4 text-slate-200" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400">No ratings yet</p>
                  </div>
                )}
              </div>

              {/* Trips card */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500 font-medium mb-2">Total Trips</p>
                <p className="text-2xl font-extrabold text-slate-900 mb-1">
                  {totalRatings}
                </p>
                <p className="text-xs text-slate-400">rides completed</p>
              </div>
            </div>

            {/* Vehicle Details */}
            {profile.role === 'driver' && hasVehicle && (
              <div className="mt-5 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-slate-500 font-medium mb-3 uppercase tracking-wider">Vehicle Details</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {profile.vehicle_make || 'Make'} {profile.vehicle_model || 'Model'}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {formatPlate(profile.plate_number)}
                      </span>
                      <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        {profile.transmission || 'Auto'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ShareWays badge */}
            <div className="mt-5 flex items-center gap-2.5 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl px-4 py-3 border border-orange-100">
              <svg className="w-5 h-5 text-orange-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
              <p className="text-xs text-slate-600">
                <span className="font-semibold text-orange-700">SHAREWAYS</span> verified rider — Sri Lanka 🇱🇰
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
