import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { updateProfile as updateFirebaseAuthProfile } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import api from '../api'
import toast from 'react-hot-toast'
import { auth, db, storage } from '../firebase'
import StarRating from '../components/StarRating'

export default function Profile() {
  const { user, getToken, logout } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    phone: user?.phoneNumber || '',
    email: user?.email || '',
    plateNumber: '',
    vehicleMake: '',
    vehicleModel: '',
    transmission: 'Auto',
    role: 'passenger', // default role
    gender: 'Male',
  })
  
  const [paymentCard, setPaymentCard] = useState(null)
  const [showCardModal, setShowCardModal] = useState(false)
  const [cardForm, setCardForm] = useState({ number: '', exp: '', cvc: '' })
  const [ratingStats, setRatingStats] = useState({ average_rating: null, total_ratings: 0 })
  const [joinedAt, setJoinedAt] = useState('')
  const [emergencyContact, setEmergencyContact] = useState({ name: '', phone: '' })
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [switchingRole, setSwitchingRole] = useState(false)

  // New states for ID & Photo
  const [verificationStatus, setVerificationStatus] = useState('unverified')
  const [idDocumentUrl, setIdDocumentUrl] = useState(null)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingId, setUploadingId] = useState(false)

  const phoneRegex = /^(?:0|94|\+94)?7\d{8}$/

  useEffect(() => {
    async function fetchProfile() {
      if (!user?.uid) {
        setLoading(false)
        return
      }
      try {
        const docRef = doc(db, 'users', user.uid)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          const data = docSnap.data()
          setFormData(prev => ({
            ...prev,
            displayName: data.displayName || data.display_name || prev.displayName,
            phone: data.phone || prev.phone,
            email: data.email || prev.email,
            plateNumber: data.plateNumber || data.plate_number || '',
            vehicleMake: data.vehicleMake || data.vehicle_make || '',
            vehicleModel: data.vehicleModel || data.vehicle_model || '',
            transmission: data.transmission || 'Auto',
            role: data.role || 'passenger',
            gender: data.gender || 'Male',
          }))
          if (data.payment_card) {
            setPaymentCard(data.payment_card)
          }
          setRatingStats({
            average_rating: data.average_rating ?? null,
            total_ratings: data.total_ratings ?? 0,
          })
          setJoinedAt(data.joined_at || '')
          if (data.emergency_contact) {
            setEmergencyContact({
              name: data.emergency_contact.name || '',
              phone: data.emergency_contact.phone || '',
            })
          }
          setVerificationStatus(data.verification_status || 'unverified')
          setIdDocumentUrl(data.idDocumentUrl || null)
          setProfilePhotoUrl(data.profilePhotoUrl || null)
        }
      } catch (err) {
        console.error('Error fetching profile:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [user?.uid])

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const photoRef = ref(storage, `profiles/${user.uid}/photo_${Date.now()}`)
      await uploadBytes(photoRef, file)
      const url = await getDownloadURL(photoRef)
      await setDoc(doc(db, 'users', user.uid), { profilePhotoUrl: url }, { merge: true })
      setProfilePhotoUrl(url)
      toast.success('Profile photo updated!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to upload photo')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleIdUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingId(true)
    try {
      const idRef = ref(storage, `verifications/${user.uid}/id_document_${Date.now()}`)
      await uploadBytes(idRef, file)
      const url = await getDownloadURL(idRef)
      await setDoc(doc(db, 'users', user.uid), { 
        idDocumentUrl: url,
        verification_status: 'pending'
      }, { merge: true })
      setIdDocumentUrl(url)
      setVerificationStatus('pending')
      toast.success('ID document uploaded for review!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to upload ID document')
    } finally {
      setUploadingId(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (formData.phone && !phoneRegex.test(formData.phone)) {
      toast.error('Please enter a valid Sri Lankan mobile number (e.g. 0771234567)')
      return
    }

    setSaving(true)
    try {
      if (auth.currentUser && formData.displayName !== user.displayName) {
        await updateFirebaseAuthProfile(auth.currentUser, {
          displayName: formData.displayName
        })
      }

      const docRef = doc(db, 'users', user.uid)
      await setDoc(docRef, {
        ...formData,
        display_name: formData.displayName, // keep snake_case for backend compatibility if needed
        plate_number: formData.plateNumber,
        vehicle_make: formData.vehicleMake,
        vehicle_model: formData.vehicleModel,
        transmission: formData.transmission,
        role: formData.role,
        gender: formData.gender,
        email: user.email,
        updatedAt: new Date(),
        emergency_contact: emergencyContact.name || emergencyContact.phone
          ? { name: emergencyContact.name, phone: emergencyContact.phone }
          : null,
      }, { merge: true })

      toast.success('Profile saved successfully!')
    } catch (err) {
      console.error('Failed to update profile:', err)
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCard = async (e) => {
    e.preventDefault()
    if (cardForm.number.length < 15) {
      toast.error('Please enter a valid card number')
      return
    }
    const last4 = cardForm.number.slice(-4)
    const newCard = { last4, exp: cardForm.exp }
    
    try {
      const token = await getToken()
      await api.put('/api/auth/profile', {
        payment_card: newCard
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      setPaymentCard(newCard)
      setShowCardModal(false)
      setCardForm({ number: '', exp: '', cvc: '' })
      toast.success('Payment method saved!')
    } catch (err) {
      toast.error('Failed to save payment method')
    }
  }

  const handleRemoveCard = async () => {
    try {
      const token = await getToken()
      await api.put('/api/auth/profile', {
        payment_card: null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setPaymentCard(null)
      toast.success('Payment method removed')
    } catch (err) {
      toast.error('Failed to remove card')
    }
  }

  const handleDeleteAccount = () => {
    setDeletingAccount(true)
    setTimeout(() => {
      setDeletingAccount(false)
      setShowDeleteModal(false)
      toast.success('Account scheduled for deletion (Demo mode)')
      logout().then(() => {
        navigate('/login')
      })
    }, 1000)
  }

  const handleRoleSwitch = async (newRole) => {
    // If trying to switch to driver without a vehicle registered
    if (newRole === 'driver' && (!formData.plateNumber || !formData.vehicleMake)) {
      setFormData(prev => ({ ...prev, role: 'driver' }))
      toast('Please enter your vehicle details below and save your profile to become a driver.', { icon: '🚗' })
      return
    }

    // Instant switch via Firestore if vehicle is already set up (or if switching to passenger)
    setSwitchingRole(true)
    try {
      const docRef = doc(db, 'users', user.uid)
      await setDoc(docRef, { role: newRole }, { merge: true })
      setFormData(prev => ({ ...prev, role: newRole }))
      toast.success(`Switched to ${newRole === 'driver' ? 'Driver' : 'Passenger'} Mode!`)
    } catch (err) {
      console.error(err)
      toast.error('Failed to switch role.')
    } finally {
      setSwitchingRole(false)
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
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Col: Main Settings */}
        <div className="md:col-span-2 space-y-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 mb-2">
              Profile <span className="gradient-text">Settings</span>
            </h1>
            <p className="text-slate-500">Manage your personal details and contact information.</p>
          </div>

          {/* Role Switcher Card */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl shadow-sm p-6 sm:p-8 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-orange-100 text-sm font-semibold mb-1">Current Mode</p>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                {formData.role === 'driver' ? 'Active as Driver 🚗' : 'Active as Passenger 🚶‍♂️'}
              </h2>
              {formData.role === 'driver' && formData.vehicleMake ? (
                <p className="text-orange-100 text-sm mt-1">Driving: {formData.vehicleMake} {formData.vehicleModel} ({formData.plateNumber})</p>
              ) : null}
            </div>
            <button
              onClick={() => handleRoleSwitch(formData.role === 'driver' ? 'passenger' : 'driver')}
              disabled={switchingRole}
              className={`shrink-0 font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2 ${
                formData.role === 'driver' 
                  ? 'bg-white/10 hover:bg-white/20 text-white' 
                  : 'bg-white text-orange-600 hover:bg-orange-50'
              }`}
            >
              {switchingRole ? (
                'Switching...'
              ) : formData.role === 'driver' ? (
                'Switch to Passenger Mode'
              ) : (
                'Switch to Driver Mode'
              )}
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <div className="flex items-center gap-6 mb-8">
              <div className="relative group w-20 h-20 rounded-full bg-orange-600 flex items-center justify-center text-white font-bold text-3xl shadow-sm overflow-hidden">
                {profilePhotoUrl ? (
                  <img src={profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  (formData.displayName || formData.email || 'U')[0].toUpperCase()
                )}
                <label className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center cursor-pointer transition-all">
                  {uploadingPhoto ? (
                    <svg className="w-6 h-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
                </label>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-900 text-lg">{formData.displayName || 'User'}</p>
                  <span className={`inline-flex items-center gap-1 border px-1.5 py-0.5 rounded text-[10px] font-bold ${formData.role === 'driver' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {formData.role === 'driver' ? (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    ) : (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0-2a3 3 0 110-6 3 3 0 010 6zm9 11a1 1 0 01-2 0c0-2.76-2.24-5-5-5h-4c-2.76 0-5 2.24-5 5a1 1 0 01-2 0c0-3.86 3.14-7 7-7h4c3.86 0 7 3.14 7 7z" /></svg>
                    )}
                    {formData.role === 'driver' ? 'Verified Driver' : 'Passenger'}
                  </span>
                </div>
                <p className="text-sm text-slate-500">{formData.email}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed opacity-70"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g. 0771234567"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Gender
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              {formData.role === 'driver' && (
                <div className="pt-6 border-t border-slate-100 relative">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-900">Vehicle Details</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Vehicle Plate Number
                      </label>
                      <input
                        type="text"
                        name="plateNumber"
                        value={formData.plateNumber}
                        onChange={handleChange}
                        placeholder="e.g. WP CAS-1234"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Transmission
                      </label>
                      <select
                        name="transmission"
                        value={formData.transmission}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
                      >
                        <option value="Auto">Auto</option>
                        <option value="Manual">Manual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Vehicle Make
                      </label>
                      <input
                        type="text"
                        name="vehicleMake"
                        value={formData.vehicleMake}
                        onChange={handleChange}
                        placeholder="e.g. Toyota"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Vehicle Model
                      </label>
                      <input
                        type="text"
                        name="vehicleModel"
                        value={formData.vehicleModel}
                        onChange={handleChange}
                        placeholder="e.g. Aqua"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary !py-3 px-6 text-sm"
                >
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Col: Rating + Payments */}
        <div className="space-y-6 md:mt-20">

          {/* Commuter Status Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-1">Commuter Status</h3>
            <p className="text-xs text-slate-500 mb-4">Your account verification status within the CommuteShareSL community.</p>
            
            <div className="flex items-center gap-3 mb-4">
              {verificationStatus === 'verified' ? (
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              ) : verificationStatus === 'pending' ? (
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                  <svg className="w-6 h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              
              <div>
                {verificationStatus === 'verified' ? (
                  <>
                    <h4 className="text-sm font-bold text-slate-900">Verified Commuter</h4>
                    <p className="text-xs text-slate-500">Identity and contact verified</p>
                  </>
                ) : (
                  <>
                    <h4 className="text-sm font-bold text-slate-900">Email Confirmed</h4>
                    <p className="text-xs text-slate-500">Identity unverified</p>
                  </>
                )}
              </div>
            </div>

            {joinedAt && (
              <p className="text-xs text-slate-400 mt-4 pt-4 border-t border-slate-100 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Member since {new Date(joinedAt).toLocaleDateString('en-LK', { month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-1">Payment Methods</h3>
            <p className="text-xs text-slate-500 mb-5">Save a card for seamless fare settlement splitting.</p>

            {paymentCard ? (
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 relative group">
                <div className="flex items-center justify-between mb-3">
                  <svg className="w-8 h-8 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  <button onClick={handleRemoveCard} className="text-xs text-red-600 hover:text-red-700 font-medium">Remove</button>
                </div>
                <p className="font-mono text-sm text-slate-700 tracking-widest mb-1">**** **** **** {paymentCard.last4}</p>
                <p className="text-xs text-slate-500">Exp: {paymentCard.exp}</p>
              </div>
            ) : (
              <button 
                onClick={() => setShowCardModal(true)}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-4 hover:border-orange-400 hover:bg-orange-50 transition-colors text-sm font-medium text-slate-600 hover:text-orange-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Payment Card
              </button>
            )}
          </div>

          {/* Emergency Contact Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center text-lg shrink-0">
                🆘
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Emergency Contact</h3>
                <p className="text-sm font-medium text-slate-700 mt-0.5">
                  This person receives an SOS push notification with your live location if you trigger the emergency button during a ride.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Contact Name</label>
                <input
                  type="text"
                  value={emergencyContact.name}
                  onChange={(e) => setEmergencyContact(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Mum, John Silva"
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="tel"
                  value={emergencyContact.phone}
                  onChange={(e) => setEmergencyContact(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="e.g. 0771234567"
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                />
              </div>
              <p className="text-sm text-slate-600 font-medium">
                Saved with your profile. Tap "Save Changes" above to apply.
              </p>
            </div>
          </div>
          
          {/* Danger Zone Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6">
            <h3 className="font-bold text-red-600 mb-1">Danger Zone</h3>
            <p className="text-xs text-slate-500 mb-4">Once you delete your account, there is no going back. Please be certain.</p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold px-4 py-2 rounded-xl transition"
            >
              Delete Account
            </button>
          </div>
        </div>
        
      </div>

      {/* Card Modal */}
      {showCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Add Card</h3>
              <button onClick={() => setShowCardModal(false)} className="text-slate-400 hover:text-slate-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSaveCard} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Card Number</label>
                <input
                  type="text"
                  placeholder="0000 0000 0000 0000"
                  maxLength={19}
                  required
                  value={cardForm.number}
                  onChange={(e) => setCardForm({...cardForm, number: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Expiry Date</label>
                  <input
                    type="text"
                    placeholder="MM/YY"
                    maxLength={5}
                    required
                    value={cardForm.exp}
                    onChange={(e) => setCardForm({...cardForm, exp: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">CVC</label>
                  <input
                    type="text"
                    placeholder="123"
                    maxLength={4}
                    required
                    value={cardForm.cvc}
                    onChange={(e) => setCardForm({...cardForm, cvc: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 font-mono"
                  />
                </div>
              </div>
              <div className="pt-2">
                <button type="submit" className="w-full btn-primary !py-2.5 text-sm">Save Card</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-scale-in text-center p-6 border-t-4 border-red-600">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Account?</h3>
            <p className="text-sm text-slate-500 mb-6">Are you sure you want to delete your SHAREWAYS account? This will permanently delete your profile and ride history.</p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
                disabled={deletingAccount}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {deletingAccount ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                    Deleting...
                  </>
                ) : (
                  'Yes, Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
