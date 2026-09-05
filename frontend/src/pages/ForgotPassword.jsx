import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import logo from '../assets/logo.png'

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) {
      toast.error('Please enter your email address')
      return
    }
    setLoading(true)
    try {
      await resetPassword(email.trim())
      setSent(true)
      toast.success('Reset link sent! Check your inbox.')
    } catch (err) {
      const code = err.code || ''
      if (code.includes('user-not-found') || code.includes('invalid-email')) {
        toast.error('No account found with that email address')
      } else {
        toast.error('Failed to send reset email. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-slide-up">

        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-5">
            <img src={logo} alt="SHAREWAYS" className="h-14 w-auto object-contain mx-auto" />
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Reset password</h1>
          <p className="text-slate-500">We'll send a reset link to your email</p>
        </div>

        <div className="glass-card p-8">
          {sent ? (
            <div className="text-center space-y-5 animate-fade-in">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 mx-auto">
                <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <div>
                <p className="text-slate-900 font-semibold">Check your inbox</p>
                <p className="text-slate-500 text-sm mt-1">
                  We sent a password reset link to <span className="text-slate-900 font-medium">{email}</span>
                </p>
                <p className="text-slate-400 text-xs mt-2">
                  Didn't receive it? Check your spam folder or{' '}
                  <button
                    onClick={() => setSent(false)}
                    className="text-orange-600 hover:text-orange-700 font-medium transition-colors"
                  >
                    try again
                  </button>
                </p>
              </div>
              <Link to="/login" className="btn-ghost w-full block text-center text-sm">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="email" className="form-label">Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field"
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Sending…' : 'Send reset link'}
              </button>

              <div className="text-center text-sm">
                <Link to="/login" className="text-slate-500 hover:text-slate-900 font-medium transition-colors">
                  ← Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
