import React from 'react';
import type { Bus } from '../../types';
import { Bus as BusIcon, AlertCircle, Check } from 'lucide-react';

interface BusPickerProps {
  buses: Bus[];
  selectedBusId: string;
  onSelect: (busId: string) => void;
  disabled?: boolean;
}

export const BusPicker: React.FC<BusPickerProps> = ({
  buses,
  selectedBusId,
  onSelect,
  disabled = false,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-[#0B1F33] uppercase tracking-wider">
          Assign KSRTC Bus
        </label>
        <span className="text-[10px] text-[#5A6E82]">
          {buses.filter((b) => b.status === 'AVAILABLE').length} available
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
        {buses.map((bus) => {
          const isSelected = selectedBusId === bus.id;
          const isAvailable = bus.status === 'AVAILABLE';
          const isAssigned = bus.status === 'ASSIGNED';
          const isMaintenance = bus.status === 'MAINTENANCE';

          return (
            <button
              key={bus.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(bus.id)}
              className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                isSelected
                  ? 'border-[#0066CC] bg-blue-50/70 ring-2 ring-[#0066CC]/20'
                  : isAvailable
                    ? 'border-[#D5DFE9] bg-white hover:border-[#0066CC]/50'
                    : 'border-red-200 bg-red-50/40 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isSelected
                        ? 'bg-[#0066CC] text-white'
                        : isAvailable
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    <BusIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#0B1F33] block">
                      {bus.registration_number}
                    </span>
                    <span className="text-[10px] text-[#5A6E82]">
                      {bus.model} • {bus.capacity} seats
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-[#0066CC] text-white flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Status & Conflict Note */}
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
                <span
                  className={`font-bold px-1.5 py-0.5 rounded ${
                    isAvailable
                      ? 'bg-green-100 text-green-800'
                      : isAssigned
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                  }`}
                >
                  {bus.status}
                </span>

                {isAssigned && (
                  <span className="text-red-600 flex items-center gap-1 font-semibold">
                    <AlertCircle className="w-3 h-3" />
                    Conflict: In service
                  </span>
                )}
                {isMaintenance && (
                  <span className="text-red-600 flex items-center gap-1 font-semibold">
                    <AlertCircle className="w-3 h-3" />
                    Maintenance
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
