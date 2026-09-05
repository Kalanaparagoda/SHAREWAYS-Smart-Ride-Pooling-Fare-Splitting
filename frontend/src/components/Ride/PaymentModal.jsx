import { useState, useEffect } from 'react';

export default function PaymentModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  baseFare, 
  tollFee = 0, 
  platformFee = 50 
}) {
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const total = baseFare + tollFee + platformFee;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsProcessing(false);
      setIsSuccess(false);
      setPaymentMethod('card');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    setIsProcessing(true);
    // Simulate network delay
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
      // Wait a moment showing success, then close and trigger callback
      setTimeout(() => {
        onConfirm(paymentMethod);
      }, 1500);
    }, 1500);
  };

  if (!isOpen) return null;

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-2xl w-full max-w-sm p-8 flex flex-col items-center justify-center shadow-2xl animate-scale-in">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-1">Payment Successful!</h3>
          <p className="text-slate-500 text-sm text-center">Your booking is confirmed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="font-bold text-slate-900 text-lg">Checkout</h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-full hover:bg-slate-100"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {/* Fare Breakdown */}
          <div className="mb-6">
            <h4 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">Fare Breakdown</h4>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Fuel Contribution</span>
                <span>LKR {baseFare.toLocaleString()}</span>
              </div>
              {tollFee > 0 && (
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Expressway Toll Share</span>
                  <span>LKR {tollFee.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-slate-600">
                <span>Platform Fee</span>
                <span>LKR {platformFee.toLocaleString()}</span>
              </div>
              <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-base">
                <span>Total Due</span>
                <span className="text-orange-600">LKR {total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">Payment Method</h4>
            <div className="space-y-3">
              
              <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'card' ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="card" 
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                  className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-slate-300 mr-3"
                />
                <div className="flex-1 flex justify-between items-center">
                  <div>
                    <span className="block text-sm font-semibold text-slate-900">Credit / Debit Card</span>
                    <span className="block text-xs text-slate-500">Secure payment via gateway</span>
                  </div>
                  <div className="flex gap-1 text-slate-400">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
                  </div>
                </div>
              </label>

              {paymentMethod === 'card' && (
                <div className="pl-8 pr-4 py-3 animate-slide-down">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Card Number</label>
                      <div className="relative">
                        <input type="text" placeholder="4242 4242 4242 4242" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                        <svg className="w-5 h-5 absolute right-3 top-2.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Expiry</label>
                        <input type="text" placeholder="MM/YY" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">CVC</label>
                        <input type="text" placeholder="123" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'qr' ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="qr" 
                  checked={paymentMethod === 'qr'}
                  onChange={() => setPaymentMethod('qr')}
                  className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-slate-300 mr-3"
                />
                <div className="flex-1 flex justify-between items-center">
                  <div>
                    <span className="block text-sm font-semibold text-slate-900">LankaQR</span>
                    <span className="block text-xs text-slate-500">Pay with any bank app</span>
                  </div>
                  <div className="flex gap-1 text-slate-400">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                  </div>
                </div>
              </label>

              <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'cash' ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="cash" 
                  checked={paymentMethod === 'cash'}
                  onChange={() => setPaymentMethod('cash')}
                  className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-slate-300 mr-3"
                />
                <div className="flex-1 flex justify-between items-center">
                  <div>
                    <span className="block text-sm font-semibold text-slate-900">Cash on Ride</span>
                    <span className="block text-xs text-slate-500">Pay the driver directly</span>
                  </div>
                  <div className="flex gap-1 text-slate-400">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  </div>
                </div>
              </label>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 sticky bottom-0">
          <button 
            onClick={handleConfirm}
            disabled={isProcessing}
            className="w-full btn-primary !py-3 font-bold text-base shadow-lg shadow-orange-500/30 disabled:opacity-70 disabled:cursor-wait"
          >
            {isProcessing ? 'Processing...' : `Confirm & Pay LKR ${total.toLocaleString()}`}
          </button>
        </div>

      </div>
    </div>
  );
}
