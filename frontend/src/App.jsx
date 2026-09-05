import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import EmergencyModal from './components/Common/EmergencyModal'

import ProtectedAdminRoute from './components/ProtectedAdminRoute'

import Home from './pages/Home'
import SearchRide from './pages/SearchRide'
import OfferRide from './pages/OfferRide'
import MyRides from './pages/MyRides'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Profile from './pages/Profile'

// Lazy-load new pages for code splitting
const PublicProfile = lazy(() => import('./pages/PublicProfile'))
const EditRide = lazy(() => import('./pages/EditRide'))
const ActiveRideBoard = lazy(() => import('./pages/ActiveRideBoard'))
const Admin = lazy(() => import('./pages/Admin'))
const LiveRide = lazy(() => import('./pages/LiveRide'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const TermsOfService = lazy(() => import('./pages/TermsOfService'))

function PageLoader() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <svg className="w-10 h-10 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <div className="flex flex-col min-h-screen bg-slate-50">
            <Navbar />
            <main className="flex-1">
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route
                    path="/search"
                    element={
                      <ProtectedRoute>
                        <SearchRide />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />

                  {/* Public profile — no auth required */}
                  <Route path="/profile/:uid" element={<PublicProfile />} />

                  {/* Protected routes */}
                  <Route
                    path="/offer"
                    element={
                      <ProtectedRoute>
                        <OfferRide />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/my-rides"
                    element={
                      <ProtectedRoute>
                        <MyRides />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <Profile />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/edit-ride/:rideId"
                    element={
                      <ProtectedRoute>
                        <EditRide />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/ride/:rideId"
                    element={
                      <ProtectedRoute>
                        <ActiveRideBoard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/live-ride/:rideId"
                    element={
                      <ProtectedRoute>
                        <LiveRide />
                      </ProtectedRoute>
                    }
                  />

                  {/* Admin Route */}
                  <Route
                    path="/admin"
                    element={
                      <ProtectedAdminRoute>
                        <Admin />
                      </ProtectedAdminRoute>
                    }
                  />

                  {/* Catch-all */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-200 bg-white py-8 px-4">
              <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-slate-500 text-sm">
                  © {new Date().getFullYear()} SHAREWAYS — Smart Ride-Pooling &amp; On-Demand Fare Splitting · Sri Lanka 🇱🇰
                </p>
                <div className="flex items-center gap-6 text-sm">
                  <a href="/privacy" className="text-slate-500 hover:text-slate-900 transition-colors">Privacy Policy</a>
                  <a href="/terms" className="text-slate-500 hover:text-slate-900 transition-colors">Terms of Service</a>
                </div>
              </div>
            </footer>
            
            {/* Global SOS button */}
            <EmergencyModal />
          </div>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  )
}
