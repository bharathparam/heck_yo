import React from 'react';
import type { Conductor } from '../../types';
import { UserCheck, AlertCircle, Check } from 'lucide-react';

interface ConductorPickerProps {
  conductors: Conductor[];
  selectedConductorId: string;
  onSelect: (conductorId: string) => void;
  disabled?: boolean;
}

export const ConductorPicker: React.FC<ConductorPickerProps> = ({
  conductors,
  selectedConductorId,
  onSelect,
  disabled = false,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-[#0B1F33] uppercase tracking-wider">
          Assign Primary Conductor
        </label>
        <span className="text-[10px] text-[#5A6E82]">
          {conductors.filter((c) => c.status === 'AVAILABLE').length} available
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
        {conductors.map((conductor) => {
          const isSelected = selectedConductorId === conductor.id;
          const isAvailable = conductor.status === 'AVAILABLE';
          const isAssigned = conductor.status === 'ASSIGNED';

          return (
            <button
              key={conductor.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(conductor.id)}
              className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                isSelected
                  ? 'border-[#F5A524] bg-amber-50/70 ring-2 ring-[#F5A524]/20'
                  : isAvailable
                    ? 'border-[#D5DFE9] bg-white hover:border-[#F5A524]/50'
                    : 'border-red-200 bg-red-50/40 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isSelected
                        ? 'bg-[#F5A524] text-[#0B1F33]'
                        : isAvailable
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#0B1F33] block">
                      {conductor.full_name}
                    </span>
                    <span className="text-[10px] text-[#5A6E82]">
                      {conductor.phone || conductor.email}
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-[#F5A524] text-[#0B1F33] flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Status & Conflict Note */}
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
                <span
                  className={`font-bold px-1.5 py-0.5 rounded ${
                    isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {conductor.status}
                </span>

                {isAssigned && (
                  <span className="text-red-600 flex items-center gap-1 font-semibold">
                    <AlertCircle className="w-3 h-3" />
                    Conflict: On duty
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
