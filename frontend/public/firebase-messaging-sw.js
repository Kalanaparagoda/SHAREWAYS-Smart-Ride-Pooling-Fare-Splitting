// Firebase Messaging Service Worker
// Place this file in /public so it's served from the root of your domain.
// Required for background push notification handling with FCM.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

// Your Firebase config — these values are safe to be in a service worker (public key material)
// They are read from meta tags injected at build time, or hardcoded here.
// IMPORTANT: Update these values to match your Firebase project.
const firebaseConfig = {
  apiKey: self.FIREBASE_API_KEY || '',
  authDomain: self.FIREBASE_AUTH_DOMAIN || '',
  projectId: self.FIREBASE_PROJECT_ID || '',
  storageBucket: self.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: self.FIREBASE_APP_ID || '',
}

firebase.initializeApp(firebaseConfig)

const messaging = firebase.messaging()

// Handle background messages (when the app tab is not in focus)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload)

  const { title, body } = payload.notification || {}
  const data = payload.data || {}

  const notificationTitle = title || 'ShareWays Notification'
  const notificationOptions = {
    body: body || '',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: data.type || 'shareways-notification',
    data: data,
    actions: data.type === 'sos_alert'
      ? [{ action: 'view', title: '📍 View Location' }]
      : [{ action: 'view', title: 'Open ShareWays' }],
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}

  let url = '/'
  if (data.type === 'sos_alert' && data.location_url) {
    url = data.location_url
  } else if (data.type === 'booking_confirmed' || data.type === 'payment_confirmed') {
    url = '/my-rides'
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})
