import { Link } from 'react-router-dom'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-6">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>
        
        <div className="space-y-6 text-slate-700">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">1. Information We Collect</h2>
            <p>We collect information you provide directly to us, such as your name, email address, phone number, and vehicle details if you are a driver. We also collect your ID documents for verification purposes.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">2. How We Use Your Information</h2>
            <p>We use the information we collect to provide, maintain, and improve our services, including to facilitate rides, process payments, and ensure the safety of our community through user verification.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">3. Data Security</h2>
            <p>We implement appropriate technical and organizational measures to protect your personal data against unauthorized or unlawful processing, accidental loss, destruction or damage. Our data is stored securely using industry-standard encryption.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">4. Sharing of Information</h2>
            <p>We may share your information with other users as necessary to facilitate rides (e.g., sharing your name and vehicle details with a passenger). We do not sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">5. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy, please contact us at support@commutesharesl.com.</p>
          </section>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-100">
          <Link to="/" className="text-orange-600 hover:text-orange-700 font-semibold text-sm">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
