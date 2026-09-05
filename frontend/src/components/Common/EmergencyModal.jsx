import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api';

export default function EmergencyModal() {
  const { user, getToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const [emergencyContact, setEmergencyContact] = useState(null);

  // Fetch coordinates and profile when modal opens
  useEffect(() => {
    if (isOpen) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => console.error("SOS Geolocation error:", err)
        );
      }
      
      if (user) {
        getToken().then(token => {
          api.get('/api/auth/profile', { headers: { Authorization: `Bearer ${token}` } })
            .then(res => {
              if (res.data.emergency_contact_number) {
                setEmergencyContact({
                  name: res.data.emergency_contact_name || 'Emergency Contact',
                  number: res.data.emergency_contact_number
                });
              }
            })
            .catch(err => console.error("Failed to load emergency contact:", err));
        });
      }
    }
  }, [isOpen, user, getToken]);

  const handleShareLocation = () => {
    let text = "🚨 URGENT: I need help! I am currently on a ShareWays ride.";
    if (coords) {
      text += `\n📍 My last known location: https://maps.google.com/?q=${coords.lat},${coords.lng}`;
    }
    
    // Copy to clipboard
    navigator.clipboard.writeText(text);
    toast.success("Emergency message copied to clipboard. Paste in WhatsApp/SMS.");
    
    // Try to open WhatsApp if possible
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <>
      {/* Floating SOS Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-red-600 hover:bg-red-700 text-white rounded-full px-4 py-3 shadow-xl flex items-center gap-2 font-bold animate-pulse transition-transform active:scale-95"
      >
        <span className="text-xl">🆘</span>
        <span className="tracking-wide">SOS</span>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in border-t-4 border-red-600">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-red-50">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🚨</span>
                <h3 className="font-extrabold text-red-700 text-lg">Emergency Assistance</h3>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              
              {/* Quick Dial Buttons */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sri Lanka Emergency Hotlines</p>
                
                <a href="tel:119" className="flex items-center justify-between p-3 rounded-xl border border-red-200 bg-white hover:bg-red-50 hover:border-red-300 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-lg">
                      👮
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">Sri Lanka Police</h4>
                      <p className="text-xs text-slate-500">General Emergency</p>
                    </div>
                  </div>
                  <span className="font-bold text-red-600 bg-red-100 px-3 py-1 rounded-lg group-hover:bg-red-200 transition-colors">119</span>
                </a>

                <a href="tel:1990" className="flex items-center justify-between p-3 rounded-xl border border-orange-200 bg-white hover:bg-orange-50 hover:border-orange-300 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-lg">
                      🚑
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">1990 Suwa Seriya</h4>
                      <p className="text-xs text-slate-500">Ambulance Service</p>
                    </div>
                  </div>
                  <span className="font-bold text-orange-600 bg-orange-100 px-3 py-1 rounded-lg group-hover:bg-orange-200 transition-colors">1990</span>
                </a>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <a href="tel:1938" className="flex items-center gap-2 p-2 rounded-lg border border-pink-200 bg-pink-50 hover:bg-pink-100 transition-colors justify-center">
                    <span className="text-sm">👩</span>
                    <div className="flex flex-col items-start">
                      <span className="text-[10px] text-pink-700 font-semibold leading-tight">Women's Help</span>
                      <span className="text-sm font-bold text-pink-900 leading-tight">1938</span>
                    </div>
                  </a>
                  <a href="tel:1919" className="flex items-center gap-2 p-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors justify-center">
                    <span className="text-sm">ℹ️</span>
                    <div className="flex flex-col items-start">
                      <span className="text-[10px] text-blue-700 font-semibold leading-tight">Govt Info</span>
                      <span className="text-sm font-bold text-blue-900 leading-tight">1919</span>
                    </div>
                  </a>
                </div>
              </div>

              <div className="w-full h-px bg-slate-100 my-4" />

              {/* Share Live Trip / Location */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Share With Trusted Contacts</p>
                <button
                  onClick={handleShareLocation}
                  className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl py-3.5 hover:bg-slate-800 transition-colors font-semibold shadow-md active:scale-95"
                >
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  Share SOS Link via WhatsApp
                </button>
                {coords ? (
                  <p className="text-[10px] text-center text-emerald-600 mt-2 font-medium">✅ GPS location acquired</p>
                ) : (
                  <p className="text-[10px] text-center text-slate-400 mt-2">Fetching GPS coordinates...</p>
                )}
                {emergencyContact && (
                  <button
                    onClick={() => {
                      let text = `🚨 URGENT: I need help! I am currently on a ShareWays ride.`;
                      if (coords) text += `\n📍 My location: https://maps.google.com/?q=${coords.lat},${coords.lng}`;
                      const cleanNum = emergencyContact.number.replace(/\D/g, '');
                      const prefix = cleanNum.startsWith('0') ? '94' + cleanNum.substring(1) : cleanNum;
                      window.open(`https://wa.me/${prefix}?text=${encodeURIComponent(text)}`, '_blank');
                    }}
                    className="w-full mt-3 flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl py-3.5 hover:bg-emerald-700 transition-colors font-semibold shadow-md active:scale-95"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    Alert {emergencyContact.name} via WhatsApp
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
