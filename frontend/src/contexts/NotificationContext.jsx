import { createContext, useContext, useEffect, useRef } from 'react'
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from './AuthContext'
import toast from 'react-hot-toast'

const NotificationContext = createContext(null)

const ICONS = {
  booking_confirmed: '🎉',
  ride_cancelled: '🚫',
}

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const unsubRef = useRef(null)

  useEffect(() => {
    // Clean up any previous listener
    if (unsubRef.current) {
      unsubRef.current()
      unsubRef.current = null
    }

    if (!user) return

    // Listen to unread notifications for this user
    const q = query(
      collection(db, 'notifications'),
      where('recipient_uid', '==', user.uid),
      where('read', '==', false),
    )

    unsubRef.current = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const notif = change.doc.data()
          const icon = ICONS[notif.type] || '🔔'

          // Show toast
          if (notif.type === 'ride_cancelled') {
            toast.error(`${icon} ${notif.title}\n${notif.message}`, {
              duration: 6000,
              style: { maxWidth: 420 },
            })
          } else {
            toast.success(`${icon} ${notif.title}\n${notif.message}`, {
              duration: 6000,
              style: { maxWidth: 420 },
            })
          }

          // Mark as read so it doesn't show again on next load
          updateDoc(doc(db, 'notifications', change.doc.id), { read: true }).catch(() => {})
        }
      })
    })

    return () => {
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
    }
  }, [user])

  return (
    <NotificationContext.Provider value={{}}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationContext)
}
