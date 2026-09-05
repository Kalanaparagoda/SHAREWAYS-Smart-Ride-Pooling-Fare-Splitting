import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../firebase'
import { requestNotificationPermission } from '../firebase'
import api from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        // Sync user profile to Firestore via backend
        try {
          const token = await firebaseUser.getIdToken()
          const res = await api.get('/api/auth/profile', {
            headers: { Authorization: `Bearer ${token}` },
          })
          setIsAdmin(res.data.is_admin === true || res.data.is_admin === 'True')
          // Register FCM push token silently — non-critical
          requestNotificationPermission().then(async (fcmToken) => {
            if (fcmToken) {
              try {
                const idToken = await firebaseUser.getIdToken()
                await api.post('/api/auth/profile/fcm-token', { token: fcmToken }, {
                  headers: { Authorization: `Bearer ${idToken}` },
                })
              } catch {
                // Non-critical — FCM registration failure shouldn't block login
              }
            }
          }).catch(() => {})
        } catch {
          // Non-critical — profile sync failure shouldn't block login
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function register(email, password, displayName, profileData = {}) {
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    // Set display name on Firebase Auth profile
    await updateProfile(credential.user, { displayName })
    // Save to Firestore via backend (including phone, nic, gender)
    const token = await credential.user.getIdToken()
    await api.put(
      '/api/auth/profile',
      {
        display_name: displayName,
        phone: profileData.phone || null,
        nic: profileData.nic || null,
        gender: profileData.gender || null,
      },
      { headers: { Authorization: `Bearer ${token}` } },
    )
    return credential.user
  }

  async function login(email, password) {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    return credential.user
  }

  async function logout() {
    await signOut(auth)
  }

  async function resetPassword(email) {
    await sendPasswordResetEmail(auth, email)
  }

  async function getToken() {
    if (!user) return null
    return user.getIdToken()
  }

  const value = { user, isAdmin, loading, register, login, logout, resetPassword, getToken }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
