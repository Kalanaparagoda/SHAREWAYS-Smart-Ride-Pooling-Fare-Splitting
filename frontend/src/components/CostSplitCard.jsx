/**
 * CostSplitCard — Visual cost breakdown for fuel cost splitting.
 * Shows: Total Cost ÷ Passengers = Per Seat
 * Props:
 *   totalCost: number  — total fuel cost in LKR
 *   passengers: number — number of passengers sharing
 *   costPerSeat: number — calculated cost per seat
 *   compact: bool      — smaller variant for RideCard
 */
export default function CostSplitCard({ totalCost, passengers, costPerSeat, compact = false }) {
  const isValid = totalCost > 0 && passengers > 0 && costPerSeat > 0

  if (!isValid) return null

  const fmt = (n) => Math.ceil(n).toLocaleString()

  if (compact) {
    return (
      <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5 animate-fade-in">
        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
          <span className="font-mono font-bold text-slate-700">LKR {fmt(totalCost)}</span>
          <span className="text-slate-300">÷</span>
          <span className="font-mono font-bold text-slate-700">{passengers} seat{passengers !== 1 ? 's' : ''}</span>
          <span className="text-slate-300">=</span>
          <span className="font-mono font-bold text-orange-600 text-sm">LKR {fmt(costPerSeat)}/seat</span>
        </div>
      </div>
    )
  }

  return (
    <div className="cost-split-gradient border border-orange-100 rounded-2xl p-5 animate-fade-in">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Cost Breakdown</p>
      
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {/* Total Cost */}
        <div className="flex flex-col items-center bg-white rounded-xl border border-orange-100 px-5 py-4 shadow-sm min-w-[96px]">
          <p className="text-xs text-slate-400 mb-1">Total Fuel</p>
          <p className="text-xl font-extrabold text-slate-900 font-mono">
            LKR {fmt(totalCost)}
          </p>
        </div>

        {/* Divider symbol */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg select-none">÷</div>
        </div>

        {/* Passengers */}
        <div className="flex flex-col items-center bg-white rounded-xl border border-slate-100 px-5 py-4 shadow-sm min-w-[88px]">
          <p className="text-xs text-slate-400 mb-1">Passengers</p>
          <p className="text-xl font-extrabold text-slate-900 font-mono">{passengers}</p>
        </div>

        {/* Equals */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg select-none">=</div>
        </div>

        {/* Per Seat */}
        <div className="flex flex-col items-center bg-orange-600 rounded-xl px-5 py-4 shadow-md shadow-orange-200 min-w-[96px]">
          <p className="text-xs text-orange-100 mb-1">Your Share</p>
          <p className="text-xl font-extrabold text-white font-mono">
            LKR {fmt(costPerSeat)}
          </p>
          <p className="text-xs text-orange-200 mt-0.5">per seat</p>
        </div>
      </div>
    </div>
  )
}
