import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { db } from '../firebase'
import { doc, onSnapshot, setDoc, collection, query, orderBy, updateDoc } from 'firebase/firestore'
import logo from '../assets/logo.png'

export default function Navbar() {
  const { user, isAdmin, logout, getToken } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const notifRef = useRef(null)
  const lastNotifIds = useRef(new Set())
  const [userProfile, setUserProfile] = useState(null)
  const [switchingRole, setSwitchingRole] = useState(false)

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Listen to user profile for quick role switching
  useEffect(() => {
    if (!user?.uid) return
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) setUserProfile(docSnap.data())
    })
    return unsubscribe
  }, [user])

  // Real-time Firestore notifications
  useEffect(() => {
    if (!user?.uid) return
    
    const q = query(collection(db, 'users', user.uid, 'notifications'), orderBy('created_at', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNotifs = snapshot.docs.map(doc => ({ dbId: doc.id, ...doc.data(), id: doc.data().id || doc.id }))
      setNotifications(newNotifs)
      
      // Check for new unread notifications to show toasts
      newNotifs.filter(n => !n.read).forEach(n => {
        if (!lastNotifIds.current.has(n.id)) {
          toast(n.message, { icon: '🔔' })
          lastNotifIds.current.add(n.id)
        }
      })
      
      // Keep track of all fetched IDs
      newNotifs.forEach(n => lastNotifIds.current.add(n.id))
    }, (err) => {
      console.error("Failed to fetch notifications:", err)
    })
    
    return unsubscribe
  }, [user])

  async function handleLogout() {
    try {
      await logout()
      toast.success('Logged out successfully')
      navigate('/login')
    } catch {
      toast.error('Logout failed')
    }
  }

  async function markAsRead(n) {
    try {
      if (n.dbId) {
        await updateDoc(doc(db, 'users', user.uid, 'notifications', n.dbId), { read: true })
      } else {
        // Fallback to API if still using it
        const token = await getToken()
        await api.put(`/api/notifications/${n.id}/read`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        })
      }
    } catch (e) {
      console.error("Failed to mark as read:", e)
    }
  }

  async function markAllAsRead() {
    try {
      const unread = notifications.filter(n => !n.read)
      for (const n of unread) {
        if (n.dbId) {
          await updateDoc(doc(db, 'users', user.uid, 'notifications', n.dbId), { read: true })
        }
      }
    } catch (e) {
      console.error("Failed to mark all as read:", e)
    }
  }

  async function handleRoleToggle() {
    if (!user?.uid || !userProfile || switchingRole) return
    const newRole = userProfile.role === 'driver' ? 'passenger' : 'driver'
    setSwitchingRole(true)
    try {
      await setDoc(doc(db, 'users', user.uid), { role: newRole }, { merge: true })
      toast.success(`Switched to ${newRole === 'driver' ? 'Driver' : 'Passenger'} Mode!`)
    } catch (e) {
      toast.error('Failed to switch role.')
    } finally {
      setSwitchingRole(false)
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const navLinkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors duration-200 ${
      isActive
        ? 'text-orange-600'
        : 'text-slate-500 hover:text-slate-900'
    }`

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-lg shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <img
            src={logo}
            alt="SHAREWAYS logo"
            className="h-12 w-auto object-contain"
          />
          <div className="flex flex-col leading-none">
            <span className="font-extrabold text-slate-900 text-base tracking-tight">
              SHAREWAYS
            </span>
            <span className="text-[10px] text-slate-400 font-normal tracking-wide hidden sm:block">
              Smart Ride-Pooling &amp; Fare Splitting
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden sm:flex items-center gap-6">
          <NavLink to="/" className={navLinkClass} end>Find a Ride</NavLink>
          {(!userProfile || userProfile.role !== 'passenger') && (
            <NavLink to="/offer" className={navLinkClass}>Post a Ride</NavLink>
          )}
          {user && (
            <NavLink to="/my-rides" className={navLinkClass}>My Rides</NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => `flex items-center gap-1.5 ${navLinkClass({isActive})} text-indigo-600`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.956 11.956 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Admin
            </NavLink>
          )}
        </div>

        {/* Auth actions */}
        <div className="hidden sm:flex items-center gap-3">
          {user ? (
            <>
              {/* Quick Role Switcher (Only if vehicle is registered) */}
              {userProfile && (userProfile.plateNumber || userProfile.plate_number) && (
                <div className="flex items-center bg-slate-100 rounded-full p-0.5 mr-2 border border-slate-200">
                  <button
                    onClick={() => userProfile.role !== 'passenger' && handleRoleToggle()}
                    disabled={switchingRole}
                    className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all ${
                      userProfile.role !== 'driver' 
                        ? 'bg-white text-slate-800 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Passenger
                  </button>
                  <button
                    onClick={() => userProfile.role !== 'driver' && handleRoleToggle()}
                    disabled={switchingRole}
                    className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all ${
                      userProfile.role === 'driver' 
                        ? 'bg-orange-500 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Driver
                  </button>
                </div>
              )}

              {/* Notification Bell */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-slate-500 hover:text-slate-900 transition-colors rounded-full hover:bg-slate-100"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm border-2 border-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
                
                {/* Notification Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-slide-up">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                      <h3 className="font-bold text-slate-900 text-sm">Notifications</h3>
                      {unreadCount > 0 && (
                        <button 
                          onClick={markAllAsRead} 
                          className="text-xs text-orange-600 hover:text-orange-700 font-semibold"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-500">
                          No notifications yet.
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div 
                            key={n.id} 
                            className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-orange-50/30' : ''}`}
                            onClick={() => { if(!n.read) markAsRead(n.id) }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h4 className={`text-sm ${!n.read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                                  {n.title}
                                </h4>
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{n.message}</p>
                                <p className="text-[10px] text-slate-400 mt-2">
                                  {new Date(n.created_at + 'Z').toLocaleString()}
                                </p>
                              </div>
                              {!n.read && (
                                <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-1"></div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Link to="/profile" className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity ml-2">
                <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white font-semibold text-xs shadow-sm overflow-hidden">
                  {userProfile?.profilePhotoUrl ? (
                    <img src={userProfile.profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    (user.displayName || user.email || 'U')[0].toUpperCase()
                  )}
                </div>
                <span className="text-slate-700 max-w-[140px] truncate font-medium hover:text-orange-600 transition-colors">
                  {user.displayName || user.email}
                </span>
              </Link>
              <button onClick={handleLogout} className="btn-ghost !px-4 !py-2 text-sm">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-slate-500 hover:text-slate-900 font-medium transition-colors">
                Log in
              </Link>
              <Link to="/register" className="btn-primary !px-4 !py-2 text-sm">
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden p-2 text-slate-500 hover:text-slate-900 transition-colors relative"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {unreadCount > 0 && !menuOpen && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
          )}
          {menuOpen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-slate-100 bg-white px-4 py-4 flex flex-col gap-4 animate-fade-in">
          <NavLink to="/" className={navLinkClass} end onClick={() => setMenuOpen(false)}>Find a Ride</NavLink>
          {(!userProfile || userProfile.role !== 'passenger') && (
            <NavLink to="/offer" className={navLinkClass} onClick={() => setMenuOpen(false)}>Post a Ride</NavLink>
          )}
          {user && (
            <NavLink to="/my-rides" className={navLinkClass} onClick={() => setMenuOpen(false)}>My Rides</NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => `flex items-center gap-1.5 ${navLinkClass({isActive})} text-indigo-600`} onClick={() => setMenuOpen(false)}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.956 11.956 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Admin Dashboard
            </NavLink>
          )}
          
          <div className="h-px bg-slate-100" />
          
          {user ? (
            <>
              <div className="flex flex-col gap-2 mb-2">
                <h3 className="font-bold text-slate-900 text-sm">Notifications</h3>
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500">No notifications</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                    {notifications.slice(0, 5).map(n => (
                      <div key={n.id} className="p-2 border border-slate-100 rounded-lg bg-slate-50" onClick={() => { if(!n.read) markAsRead(n.id) }}>
                        <h4 className={`text-xs ${!n.read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                          {n.title} {!n.read && <span className="w-2 h-2 rounded-full bg-orange-500 inline-block ml-1"></span>}
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="h-px bg-slate-100" />
              
              {/* Mobile Quick Role Switcher */}
              {userProfile && (userProfile.plateNumber || userProfile.plate_number) && (
                <div className="flex flex-col gap-2 mb-2 mt-2">
                  <h3 className="font-bold text-slate-900 text-sm">Mode</h3>
                  <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                    <button
                      onClick={() => userProfile.role !== 'passenger' && handleRoleToggle()}
                      disabled={switchingRole}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        userProfile.role !== 'driver' 
                          ? 'bg-white text-slate-800 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Passenger
                    </button>
                    <button
                      onClick={() => userProfile.role !== 'driver' && handleRoleToggle()}
                      disabled={switchingRole}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        userProfile.role === 'driver' 
                          ? 'bg-orange-500 text-white shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Driver
                    </button>
                  </div>
                </div>
              )}

              <Link to="/profile" className="text-slate-600 text-sm truncate font-medium flex items-center justify-between hover:text-orange-600 transition-colors mt-2" onClick={() => setMenuOpen(false)}>
                <span>{user.displayName || user.email}</span>
                <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Profile</span>
              </Link>
              <button onClick={handleLogout} className="btn-ghost text-sm text-left">Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-slate-600 font-medium" onClick={() => setMenuOpen(false)}>Log in</Link>
              <Link to="/register" className="btn-primary text-sm text-center" onClick={() => setMenuOpen(false)}>Sign up</Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
