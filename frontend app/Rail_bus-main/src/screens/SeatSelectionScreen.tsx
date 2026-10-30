import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Clock, MapPin, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { SeatStepper } from '../components/booking/SeatStepper';
import { api } from '../services/api';
import type { Trip, RouteStop } from '../types';

export const SeatSelectionScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, activeBookingFlow, updateBookingFlow, trips } = useApp();

  const stateData = location.state as {
    trip?: Trip;
    destinationStop?: RouteStop;
    destinationStopId?: string;
  } | null;

  const currentTrip = stateData?.trip || trips.find((t) => t.id === activeBookingFlow.selectedTripId) || trips[0];
  const destinationStopId = stateData?.destinationStopId || activeBookingFlow.destinationStopId;

  const [seatCount, setSeatCount] = useState<number>(activeBookingFlow.seatCount || 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!currentTrip) {
    navigate('/');
    return null;
  }

  const destName = stateData?.destinationStop?.stop_name || currentTrip.destination;
  const farePerSeat = currentTrip.base_fare || 50;
  const totalFare = seatCount * farePerSeat;

  const handleProceedToPayment = async () => {
    setBusy(true);
    setError('');
    try {
      // Persist or generate idempotency key for this booking session
      const idempotencyKey = `rb_book_${currentTrip.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      sessionStorage.setItem('railbus_last_idempotency_key', idempotencyKey);

      const booking = await api.createBooking(currentTrip.id, destinationStopId, seatCount, idempotencyKey);
      updateBookingFlow({
        selectedTripId: currentTrip.id,
        destinationStopId,
        seatCount,
      });

      navigate('/book/pay', {
        state: {
          booking,
          trip: currentTrip,
          destinationStopId,
          seatCount,
          totalFare,
          idempotencyKey,
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create reservation. Please retry.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-md mx-auto space-y-4 pb-24 pt-20 px-4">
      {/* Top Bar with Back Arrow */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-white border border-[#D9E1EA] flex items-center justify-center text-[#0B1F33] active:scale-95 transition-transform shadow-sm"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-xl text-[#0B1F33] tracking-tight">{t.seats.title}</h1>
        <div className="w-10" />
      </div>

      {/* Selected Trip Capsule */}
      <div className="bg-[#0B1F33] text-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-[#F5A524] font-semibold">
            <Clock className="w-3.5 h-3.5" />
            <span>
              Train {currentTrip.train_number} · {currentTrip.travel_date}
            </span>
          </div>
          <div className="flex items-center gap-1 text-base font-bold">
            <MapPin className="w-4 h-4 text-[#F5A524]" />
            <span>{destName}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-[#A0B0C0] block">Fixed Fare</span>
          <span className="text-xl font-bold font-mono text-white">₹{farePerSeat}</span>
        </div>
      </div>

      {/* Seat Stepper Component */}
      <SeatStepper
        value={seatCount}
        min={1}
        max={Math.min(6, currentTrip.seats_remaining || 6)}
        unitFare={farePerSeat}
        onChange={(val) => setSeatCount(val)}
      />

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-[#FDE8E8] text-xs font-semibold text-[#D32F2F] flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary CTA Action */}
      <div className="pt-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleProceedToPayment()}
          className="w-full h-[52px] rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all bg-[#F5A524] text-[#0B1F33] shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating reservation…
            </>
          ) : (
            <>
              <span>Continue to payment · ₹{totalFare}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
