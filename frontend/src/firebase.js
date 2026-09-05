// Firebase client SDK — browser-side (auth + Firestore + FCM)
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
import { getStorage } from 'firebase/storage'
export const storage = getStorage(app)

// FCM — only available in supported browsers (not Safari < 16.4)
let messaging = null
const initMessaging = async () => {
  if (messaging) return messaging
  const supported = await isSupported()
  if (supported) {
    messaging = getMessaging(app)
  }
  return messaging
}

/**
 * Request notification permission and return the FCM registration token.
 * Returns null if permission denied or FCM not supported.
 */
export async function requestNotificationPermission() {
  try {
    const m = await initMessaging()
    if (!m) return null

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
    if (!vapidKey) {
      console.warn('[FCM] VITE_FIREBASE_VAPID_KEY is not set — push notifications disabled.')
      return null
    }

    const token = await getToken(m, { vapidKey })
    return token || null
  } catch (err) {
    console.warn('[FCM] Failed to get notification token:', err)
    return null
  }
}

/**
 * Listen for foreground FCM messages (app tab is active).
 * Returns an unsubscribe function.
 */
export async function onForegroundMessage(callback) {
  const m = await initMessaging()
  if (!m) return () => {}
  return onMessage(m, callback)
}

export default app
