import React from 'react';
import { Minus, Plus, Users, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface SeatStepperProps {
  value: number;
  min?: number;
  max?: number;
  unitFare: number;
  onChange: (val: number) => void;
}

export const SeatStepper: React.FC<SeatStepperProps> = ({
  value,
  min = 1,
  max = 6,
  unitFare,
  onChange,
}) => {
  const { t } = useApp();

  const handleDecrement = () => {
    if (value > min) onChange(value - 1);
  };

  const handleIncrement = () => {
    if (value < max) onChange(value + 1);
  };

  const totalFare = value * unitFare;

  return (
    <div className="bg-white rounded-2xl p-5 border border-[#D9E1EA] shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#F3F6FA] flex items-center justify-center text-[#0B1F33]">
            <Users className="w-5 h-5 text-[#0B1F33]" />
          </div>
          <div>
            <h3 className="font-bold text-[15px] text-[#0B1F33]">{t.seats.passengersLabel}</h3>
            <p className="text-xs text-[#74777d]">{t.seats.maxSeatsNotice}</p>
          </div>
        </div>

        {/* Counter Stepper Controls */}
        <div className="flex items-center gap-3 bg-[#F3F6FA] p-1.5 rounded-2xl border border-[#D9E1EA]">
          <button
            type="button"
            onClick={handleDecrement}
            disabled={value <= min}
            aria-label="Decrease passenger count"
            className="w-10 h-10 rounded-xl bg-white border border-[#D9E1EA] flex items-center justify-center text-[#0B1F33] disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all shadow-sm"
          >
            <Minus className="w-4 h-4" />
          </button>
          
          <span className="w-8 text-center font-bold text-lg text-[#0B1F33] font-mono">
            {value}
          </span>

          <button
            type="button"
            onClick={handleIncrement}
            disabled={value >= max}
            aria-label="Increase passenger count"
            className="w-10 h-10 rounded-xl bg-white border border-[#D9E1EA] flex items-center justify-center text-[#0B1F33] disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Fare Breakdown Card */}
      <div className="p-4 rounded-xl bg-[#ecf4fe] border border-[#c4c6cd]/50 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-[#74777d] uppercase tracking-wider">{t.seats.fareSummary}</span>
          <p className="text-xs text-[#44474c] mt-0.5">
            {value} seat{value > 1 ? 's' : ''} × ₹{unitFare}
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-[#0B1F33] font-mono">₹{totalFare}</span>
          <span className="block text-[10px] text-[#74777d]">Fixed KSRTC fare</span>
        </div>
      </div>

      {/* Open Seating Notice */}
      <div className="flex items-start gap-2 text-xs text-[#74777d] bg-[#F3F6FA] p-3 rounded-xl border border-[#D9E1EA]">
        <Info className="w-4 h-4 text-[#0B1F33] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          {t.seats.subtitle} Seats are open-choice as you board.
        </p>
      </div>
    </div>
  );
};
