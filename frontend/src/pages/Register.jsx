import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import logo from '../assets/logo.png'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    nic: '',
    gender: '',
    password: '',
    confirm: '',
  })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function onChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.email || !form.password) {
      toast.error('Please fill in all fields')
      return
    }
    if (!form.phone.trim()) {
      toast.error('Phone number is required')
      return
    }
    if (!form.nic.trim()) {
      toast.error('NIC / ID number is required')
      return
    }
    if (!form.gender) {
      toast.error('Please select your gender')
      return
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await register(form.email.trim(), form.password, form.name.trim(), {
        phone: form.phone.trim(),
        nic: form.nic.trim(),
        gender: form.gender,
      })
      toast.success('Account created! Welcome to SHAREWAYS 🚗')
      navigate('/')
    } catch (err) {
      const code = err.code || ''
      if (code.includes('email-already-in-use')) {
        toast.error('An account with this email already exists')
      } else if (code.includes('invalid-email')) {
        toast.error('Please enter a valid email address')
      } else if (code.includes('weak-password')) {
        toast.error('Password must be at least 6 characters')
      } else {
        toast.error('Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const passwordStrength = (() => {
    const p = form.password
    if (!p) return null
    if (p.length < 6) return { label: 'Too short', color: 'bg-red-500', width: '25%' }
    if (p.length < 8) return { label: 'Weak', color: 'bg-orange-500', width: '45%' }
    if (!/[A-Z]/.test(p) || !/[0-9]/.test(p)) return { label: 'Fair', color: 'bg-yellow-500', width: '65%' }
    return { label: 'Strong', color: 'bg-emerald-500', width: '100%' }
  })()

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-slide-up">

        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-5">
            <img src={logo} alt="SHAREWAYS" className="h-14 w-auto object-contain mx-auto" />
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Create account</h1>
          <p className="text-slate-500">Join Sri Lanka's smart carpooling community</p>
        </div>

        {/* Form */}
        <div className="glass-card p-8 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* Full Name */}
            <div>
              <label htmlFor="name" className="form-label">Full name</label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                autoFocus
                value={form.name}
                onChange={onChange}
                placeholder="Kalana Perera"
                className="input-field"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="form-label">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={onChange}
                placeholder="you@example.com"
                className="input-field"
              />
            </div>

            {/* Phone + NIC side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="form-label">Phone number</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={onChange}
                  placeholder="07X XXX XXXX"
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="nic" className="form-label">NIC / ID number</label>
                <input
                  id="nic"
                  name="nic"
                  type="text"
                  value={form.nic}
                  onChange={onChange}
                  placeholder="XXXXXXXXXX"
                  maxLength={12}
                  className="input-field"
                />
              </div>
            </div>

            {/* Gender */}
            <div>
              <label htmlFor="gender" className="form-label">Gender</label>
              <select
                id="gender"
                name="gender"
                value={form.gender}
                onChange={onChange}
                className="input-field bg-white"
              >
                <option value="">Select gender…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Prefer not to say</option>
              </select>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="form-label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={onChange}
                  placeholder="Min. 6 characters"
                  className="input-field pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                </button>
              </div>
              {/* Password strength bar */}
              {passwordStrength && (
                <div className="mt-2">
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${passwordStrength.color}`}
                      style={{ width: passwordStrength.width }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{passwordStrength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirm" className="form-label">Confirm password</label>
              <input
                id="confirm"
                name="confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.confirm}
                onChange={onChange}
                placeholder="Repeat your password"
                className={`input-field ${
                  form.confirm && form.password !== form.confirm
                    ? '!border-red-400 !ring-red-400/30'
                    : ''
                }`}
              />
              {form.confirm && form.password !== form.confirm && (
                <p className="text-xs text-red-500 mt-1">Passwords don't match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div className="text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-orange-600 hover:text-orange-700 font-semibold transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
