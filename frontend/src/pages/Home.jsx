import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'

const features = [
  {
    icon: (
      <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
    title: '30+ Sri Lankan Cities',
    desc: 'Connect with fellow commuters across the island — from Colombo to Jaffna, Kandy to Galle.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Smart Fare Splitting',
    desc: 'Built-in fuel calculator — split by distance or enter costs directly. Always transparent, always fair.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: 'Secure & Verified',
    desc: 'Firebase Authentication ensures only real users can post and book rides on the platform.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: 'Real-Time Bookings',
    desc: 'Transactional seat management prevents overbooking when multiple passengers book at the same time.',
  },
]

const stats = [
  { label: 'Cities Covered', value: '30+' },
  { label: 'Avg. Fuel Savings', value: '60%' },
  { label: 'Carbon Footprint', value: '↓ 40%' },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-32 w-[500px] h-[500px] bg-orange-100 rounded-full opacity-50 blur-3xl" />
          <div className="absolute top-40 -left-24 w-[360px] h-[360px] bg-orange-50 rounded-full opacity-60 blur-2xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">

          {/* Badge pill */}
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold px-4 py-1.5 rounded-full mb-8 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            NOW LIVE IN SRI LANKA
          </div>

          {/* Logo mark — transparent container, no background box */}
          <img src={logo} alt="SHAREWAYS" className="h-36 w-auto object-contain mx-auto mb-6 drop-shadow-md" />

          <h1 className="text-5xl sm:text-6xl font-extrabold text-slate-900 leading-tight mb-4">
            SHAREWAYS
          </h1>
          <p className="text-xl sm:text-2xl font-medium text-slate-500 max-w-2xl mx-auto mb-4 leading-snug">
            Commute together, save together. The smart carpooling & 
            <span className="text-amber-600 font-semibold"> fare-splitting</span> network for Sri Lanka.
          </p>
          <p className="text-slate-400 text-base max-w-xl mx-auto mb-10">
            Share your daily commute, split fuel costs fairly, and travel comfortably across the island.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/search"
              id="cta-find-ride"
              className="inline-flex items-center justify-center gap-2 text-base font-semibold px-8 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-900 shadow-sm shadow-amber-400/30 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              Find a Ride
            </Link>
            <Link
              to="/offer"
              id="cta-offer-ride"
              className="btn-ghost text-base !px-8 !py-3.5 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
              Offer a Ride
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────── */}
      <section className="border-y border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 py-10 grid grid-cols-3 gap-6 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-extrabold text-amber-500">{s.value}</p>
              <p className="text-sm text-slate-500 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">How SHAREWAYS Works</h2>
          <p className="text-slate-500 max-w-lg mx-auto">
            Three simple steps to a smarter, cheaper commute.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              title: 'Search a Ride',
              desc: 'Pick your origin, destination, date and number of seats. Browse matching rides instantly.',
              icon: (
                <svg className="w-7 h-7 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              ),
            },
            {
              step: '02',
              title: 'Book Your Seat',
              desc: 'Select how many seats you need, review the fare split, and confirm your booking instantly.',
              icon: (
                <svg className="w-7 h-7 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                </svg>
              ),
            },
            {
              step: '03',
              title: 'Share & Save',
              desc: 'Meet your driver, share the journey, and pay only your fair portion of the fuel cost.',
              icon: (
                <svg className="w-7 h-7 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
          ].map((item) => (
            <div key={item.step} className="glass-card p-8 text-center hover:shadow-md transition-shadow duration-300 group">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 mb-5 group-hover:bg-orange-100 transition-colors">
                {item.icon}
              </div>
              <div className="text-xs font-bold text-amber-500 tracking-widest mb-2">{item.step}</div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature cards ────────────────────────────────────────── */}
      <section className="bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Everything You Need</h2>
            <p className="text-slate-500 max-w-lg mx-auto">
              Built specifically for Sri Lanka's roads and commuters.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-slate-100 bg-slate-50 hover:border-orange-200 hover:bg-orange-50/30 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center mb-4 shadow-sm">
                  {f.icon}
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ───────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-20">
        <div className="glass-card p-10 sm:p-14 text-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full opacity-80 blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-100 rounded-full opacity-60 blur-2xl translate-y-1/2 -translate-x-1/4" />
          </div>
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
              Ready to share your next ride?
            </h2>
            <p className="text-slate-500 text-lg mb-8 max-w-xl mx-auto">
              Join the growing community of Sri Lankan commuters travelling smarter every day.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register" id="cta-get-started" className="inline-flex items-center justify-center text-base font-semibold px-10 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-900 shadow-sm shadow-amber-400/30 transition-all duration-200">
                Get Started — It's Free
              </Link>
              <Link to="/search" id="cta-browse-rides" className="btn-ghost text-base !px-10 !py-3.5">
                Browse Rides
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
