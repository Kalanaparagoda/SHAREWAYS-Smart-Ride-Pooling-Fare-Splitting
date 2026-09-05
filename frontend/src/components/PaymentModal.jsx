import { useState } from 'react';

export default function PaymentModal({ booking, onClose, onPaid }) {
  const [method, setMethod] = useState('card');
  const [status, setStatus] = useState('idle'); // idle, processing, success

  const fare = Number(booking?.totalFare || booking?.total_cost || booking?.fare || 2594);
  const platformFee = 0; // Demo
  const totalDue = fare + platformFee;

  const handlePay = () => {
    setStatus('processing');
    setTimeout(() => {
      setStatus('success');
    }, 1500);
  };

  const handleDone = () => {
    onPaid(); // Trigger the parent callback to refresh data
  };

  if (status === 'success') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in duration-300">
          <div className="mx-auto w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Payment Successful!</h2>
          <p className="text-slate-500 mb-6">
            You've successfully paid LKR {totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })} for your ride.
          </p>
          <button 
            onClick={handleDone}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Checkout</h2>
            <p className="text-sm text-slate-500 mt-0.5">Demo Payment Gateway</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          {/* Fare Breakdown */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Fare Breakdown</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Base Fuel Split</span>
                <span>LKR {fare.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Platform Fee</span>
                <span>LKR {platformFee.toFixed(2)}</span>
              </div>
              <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-base">
                <span>Total Payable</span>
                <span>LKR {totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3">Select Payment Method</h3>
            <div className="space-y-3">
              
              {/* Card Option */}
              <label className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${method === 'card' ? 'border-orange-500 bg-orange-50' : 'border-slate-100 hover:border-slate-200'}`}>
                <input type="radio" name="paymentMethod" value="card" checked={method === 'card'} onChange={() => setMethod('card')} className="mt-1 w-4 h-4 text-orange-600 focus:ring-orange-500 border-slate-300" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-900 text-sm">Credit / Debit Card</span>
                    <div className="flex gap-1">
                      {/* Fake Visa/MC icons */}
                      <div className="w-8 h-5 bg-blue-600 rounded flex items-center justify-center text-[8px] text-white font-bold italic">VISA</div>
                      <div className="w-8 h-5 bg-red-500 rounded flex items-center justify-center text-[8px] text-white font-bold relative overflow-hidden">
                        <div className="absolute w-4 h-4 bg-orange-400 rounded-full -left-1 opacity-80"></div>
                        <div className="absolute w-4 h-4 bg-yellow-400 rounded-full -right-1 opacity-80"></div>
                      </div>
                    </div>
                  </div>
                  {method === 'card' && (
                    <div className="mt-3 space-y-2 animate-in slide-in-from-top-1">
                      <input type="text" disabled value="•••• •••• •••• 4242" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 opacity-70" />
                      <div className="flex gap-2">
                        <input type="text" disabled value="12/28" className="w-1/2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 opacity-70" />
                        <input type="text" disabled value="123" className="w-1/2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 opacity-70" />
                      </div>
                    </div>
                  )}
                </div>
              </label>

              {/* LankaQR Option */}
              <label className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${method === 'qr' ? 'border-orange-500 bg-orange-50' : 'border-slate-100 hover:border-slate-200'}`}>
                <input type="radio" name="paymentMethod" value="qr" checked={method === 'qr'} onChange={() => setMethod('qr')} className="mt-1 w-4 h-4 text-orange-600 focus:ring-orange-500 border-slate-300" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 text-sm">LankaQR / FriMi / Genie</span>
                    <span className="text-[10px] font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded">LankaQR</span>
                  </div>
                  {method === 'qr' && (
                    <div className="mt-4 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-xl p-4 animate-in slide-in-from-top-1">
                      <div className="w-32 h-32 bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center">
                        <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                      </div>
                      <p className="text-xs text-slate-500 mt-3 text-center">Scan with your banking app</p>
                    </div>
                  )}
                </div>
              </label>

              {/* Cash Option */}
              <label className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${method === 'cash' ? 'border-orange-500 bg-orange-50' : 'border-slate-100 hover:border-slate-200'}`}>
                <input type="radio" name="paymentMethod" value="cash" checked={method === 'cash'} onChange={() => setMethod('cash')} className="mt-1 w-4 h-4 text-orange-600 focus:ring-orange-500 border-slate-300" />
                <div className="flex-1">
                  <span className="font-semibold text-slate-900 text-sm block mb-1">Cash on Drop-off</span>
                  <p className="text-xs text-slate-500">Pay directly to the driver at the end of the trip.</p>
                </div>
              </label>

            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 bg-white">
          <button
            onClick={handlePay}
            disabled={status === 'processing'}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {status === 'processing' ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </>
            ) : (
              method === 'cash' ? 'Confirm Cash Payment' : `Pay LKR ${totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
