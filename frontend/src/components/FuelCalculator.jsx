import { useState, useEffect } from 'react';
import CostSplitCard from './CostSplitCard';

// Fixed fuel price per litre (LKR)
const FIXED_FUEL_PRICE = 399; // Standard regulated rate

export default function FuelCalculator({ onCostChange, initialCost, autoDistance, fuelType = 'Petrol', passengers = 1 }) {
  // Input states
  const [distanceKm, setDistanceKm] = useState('');
  const [efficiencyKmL, setEfficiencyKmL] = useState(''); // km per litre or km per kWh

  const isEV = fuelType === 'Full Electric (EV)';
  const fuelRate = fuelType === 'Diesel' ? 382 : (fuelType === 'Petrol' ? 399 : 14); // 14 LKR/km for EV running cost

  // Compute cost per seat using distance, efficiency, and fixed fuel price
  const costPerSeat = (() => {
    const dist = parseFloat(distanceKm);
    const eff = parseFloat(efficiencyKmL) || (isEV ? 6 : 12); // default efficiency
    const s = parseInt(passengers) || 1;
    if (!dist || s < 1) return 0;
    
    if (isEV) {
      // For EV, cost is calculated directly as distance * rate per km (LKR 14/km base standard)
      const total = dist * fuelRate;
      return Math.ceil(total / s);
    } else {
      const units = dist / eff;
      const total = units * fuelRate;
      return Math.ceil(total / s);
    }
  })();

  // Total cost for cost-split card
  const totalCostForCard = (() => {
    const dist = parseFloat(distanceKm) || 0;
    const eff = parseFloat(efficiencyKmL) || (isEV ? 6 : 12);
    if (isEV) return Math.ceil(dist * fuelRate) || 0;
    const units = dist / eff;
    return Math.ceil(units * fuelRate) || 0;
  })();

  const passengersForCard = parseInt(passengers) || 1;

  // Propagate cost per seat upwards
  useEffect(() => {
    onCostChange?.(costPerSeat);
  }, [costPerSeat]);

  // Pre-populate if initialCost is provided (edit mode)
  useEffect(() => {
    if (initialCost && initialCost > 0 && !distanceKm) {
      if (isEV) {
        const approxDist = Math.round(initialCost / fuelRate);
        setDistanceKm(approxDist.toString());
      } else {
        const approxDist = Math.round((initialCost / fuelRate) * 12);
        setDistanceKm(approxDist.toString());
      }
      setEfficiencyKmL('');
    }
  }, [initialCost, isEV, fuelRate]);

  // Auto‑populate distance from RouteMap if provided
  useEffect(() => {
    if (autoDistance && autoDistance > 0) {
      setDistanceKm(Math.round(autoDistance).toString());
    }
  }, [autoDistance]);

  return (
    <div className="glass-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">Fuel Cost Calculator</h3>
          <p className="text-xs text-slate-400">Split fuel costs fairly with your passengers</p>
        </div>
      </div>

      {/* Input fields */}
      <div className="space-y-3 animate-fade-in">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Distance (km)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={distanceKm}
              onChange={e => setDistanceKm(e.target.value)}
              placeholder="e.g. 120"
              className="input-field"
            />
          </div>
          <div>
            <label className="form-label">{isEV ? "Energy Efficiency (km/kWh) - Optional" : "Fuel Efficiency (km/L)"}</label>
            <input
              type="number"
              min="1"
              max="100"
              step="0.5"
              value={efficiencyKmL}
              onChange={e => setEfficiencyKmL(e.target.value)}
              placeholder={isEV ? "e.g. 6" : "e.g. 12"}
              className="input-field"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div className="flex items-center justify-center border border-slate-200 bg-slate-50 rounded-lg p-2 text-center">
            <span className="text-xs text-slate-500">
              {isEV ? `EV Running Rate (LKR ${fuelRate}/km)` : `Standard rate (LKR ${fuelRate}/L)`}
            </span>
          </div>
        </div>
        {distanceKm && (
          <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 flex items-center gap-4">
            {isEV ? (
              <>
                <span>⚡ {distanceKm} km trip</span>
                <span>Total: LKR {Math.ceil(parseFloat(distanceKm) * fuelRate)}</span>
              </>
            ) : (
              <>
                <span>⛽ {(parseFloat(distanceKm) / (parseFloat(efficiencyKmL) || 12)).toFixed(1)} L used</span>
                <span>Total: LKR {Math.ceil((parseFloat(distanceKm) / (parseFloat(efficiencyKmL) || 12)) * fuelRate)}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Simple result line */}
      <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
        <div>
          <p className="text-xs text-slate-500 font-medium">Cost per passenger</p>
          <p className="text-2xl font-bold text-orange-600 mt-0.5 font-mono">
            {costPerSeat > 0 ? `LKR ${costPerSeat.toLocaleString()}` : '—'}
          </p>
        </div>
        {costPerSeat > 0 && (
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}
      </div>

      {/* Visual cost‑split card */}
      <CostSplitCard totalCost={totalCostForCard} passengers={passengersForCard} costPerSeat={costPerSeat} />
    </div>
  );
}



