import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export const AlternativesScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col w-full max-w-md mx-auto space-y-4 pb-28 pt-20 px-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white border border-[#D9E1EA] flex items-center justify-center text-[#0B1F33] active:scale-95 transition-transform shadow-sm"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-xl text-[#0B1F33] tracking-tight">
          Alternative Transit
        </h1>
        <div className="w-10" />
      </div>

      <div className="bg-white rounded-2xl p-5 border border-[#D9E1EA] shadow-sm flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-[#B76E00] shrink-0" />
        <div><h3 className="font-bold text-sm text-[#0B1F33]">No alternative transport feed connected</h3><p className="text-xs text-[#74777d] mt-2 leading-relaxed">If a route does not reach 20 confirmed seats by its travel date, RailBus cancels the ticket and marks the demand group unavailable. This MVP does not show live city bus, taxi, or fare information; check current options with station staff.</p></div>
      </div>

      {/* Action to return to Booking */}
      <div className="pt-2">
        <button
          onClick={() => navigate('/')}
          className="w-full h-12 rounded-xl bg-[#0B1F33] text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform shadow-sm"
        >
          <span>Find Another RailBus Feeder Trip</span>
        </button>
      </div>
    </div>
  );
};
