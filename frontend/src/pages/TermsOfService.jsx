import { Link } from 'react-router-dom'

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-6">Terms of Service</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>
        
        <div className="space-y-6 text-slate-700">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using the ShareWays (CommuteShareSL) platform, you agree to be bound by these Terms of Service. If you do not agree, you may not access or use the platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">2. User Conduct</h2>
            <p>You agree to use our platform for lawful purposes only. You must not use our platform to engage in any activity that is illegal, harmful, or violates the rights of others. Both drivers and passengers must respect each other and follow agreed-upon ride details.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">3. Verification</h2>
            <p>We may require you to verify your identity by providing government-issued ID documents. You agree to provide accurate and truthful information. We reserve the right to suspend or terminate accounts that fail to comply with verification requirements.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">4. Limitation of Liability</h2>
            <p>ShareWays facilitates connections between drivers and passengers. We do not provide transportation services ourselves. To the maximum extent permitted by law, ShareWays shall not be liable for any direct, indirect, incidental, or consequential damages arising out of your use of the platform or any rides arranged through it.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">5. Changes to Terms</h2>
            <p>We reserve the right to modify these Terms of Service at any time. We will notify you of any material changes by posting the new Terms on this page.</p>
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
