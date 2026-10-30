import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, AlertCircle, Loader2, ShieldCheck, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import type { Booking, Trip } from '../types';

export const PaymentScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeBookingFlow, refreshData } = useApp();

  const stateData = location.state as {
    booking?: Booking;
    trip?: Trip;
    seatCount?: number;
    destinationStopId?: string;
    totalFare?: number;
    idempotencyKey?: string;
  } | null;

  const trip = stateData?.trip;
  const initialBooking = stateData?.booking;
  const seatCount = stateData?.seatCount || activeBookingFlow.seatCount || 1;
  const destinationStopId = stateData?.destinationStopId || activeBookingFlow.destinationStopId;

  // Persisted idempotency key
  const [idempotencyKey] = useState<string>(
    () =>
      stateData?.idempotencyKey ||
      sessionStorage.getItem('railbus_last_idempotency_key') ||
      `rb_pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  );

  const [paymentState, setPaymentState] = useState<'PENDING_PAYMENT' | 'PROCESSING' | 'FAILED' | 'SUCCESS'>('PENDING_PAYMENT');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [error, setError] = useState('');

  if (!trip) {
    navigate('/');
    return null;
  }

  const destination = trip.destination || 'Mysuru Destination';
  const totalFare = stateData?.totalFare || trip.base_fare * seatCount;

  const handlePay = async () => {
    setPaymentState('PROCESSING');
    setError('');
    try {
      const confirmedBooking = await api.payForReservation(
        trip.id,
        destinationStopId,
        seatCount,
        initialBooking?.id,
        idempotencyKey,
        simulateFailure
      );
      setPaymentState('SUCCESS');
      await refreshData();
      navigate(`/tickets/${confirmedBooking.id}`, {
        replace: true,
        state: { isNewBooking: true, booking: confirmedBooking },
      });
    } catch (cause) {
      setPaymentState('FAILED');
      setError(cause instanceof Error ? cause.message : 'Payment simulation failed. Please retry.');
    }
  };

  return (
    <div className="flex flex-col w-full max-w-md mx-auto space-y-4 pb-24 pt-20 px-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/book/seats', { state: { trip, destinationStopId } })}
          className="w-10 h-10 rounded-full bg-white border border-[#D9E1EA] flex items-center justify-center text-[#0B1F33] active:scale-95 transition-transform shadow-sm"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-xl text-[#0B1F33]">Simulated payment checkout</h1>
        <div className="w-10" />
      </div>

      <section className="bg-white rounded-2xl p-5 border border-[#D9E1EA] shadow-sm space-y-4">
        {/* Payment pending state indicator */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#F3F6FA] border border-[#D9E1EA]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#0B1F33]" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#74777d]">Status</span>
              <div className="text-xs font-bold text-[#0B1F33]">
                {paymentState === 'PENDING_PAYMENT' && 'PAYMENT PENDING'}
                {paymentState === 'PROCESSING' && 'PROCESSING PAYMENT…'}
                {paymentState === 'FAILED' && 'PAYMENT FAILED · RETRY READY'}
                {paymentState === 'SUCCESS' && 'PAYMENT COMPLETED'}
              </div>
            </div>
          </div>
          <span className="font-mono text-[10px] bg-white border border-[#D9E1EA] px-2 py-0.5 rounded text-[#74777d]">
            IDEMPOTENT
          </span>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-[#74777d]">Journey details</div>
          <div className="font-bold text-base text-[#0B1F33]">Mysuru Junction &rarr; {destination}</div>
          <div className="text-xs text-[#74777d]">
            Train {trip.train_number} · Travel Date: {trip.travel_date}
          </div>
        </div>

        <div className="border-t border-dashed border-[#D9E1EA] pt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="block text-xs text-[#74777d]">Seats reserved</span>
            <b>{seatCount} seat{seatCount > 1 ? 's' : ''}</b>
          </div>
          <div>
            <span className="block text-xs text-[#74777d]">Total fare amount</span>
            <b className="font-mono text-lg text-[#0B1F33]">₹{totalFare}</b>
          </div>
        </div>

        <div className="rounded-xl bg-[#EBF2FA] p-3 text-xs text-[#0B1F33] leading-relaxed">
          <b className="block mb-1">Simulated Direct Payment (MVP):</b>
          This records your reservation as paid. Your ticket will be issued once the 20-passenger threshold is achieved and Admin approves dispatch. If the threshold is not reached before deadline, you will receive a full refund.
        </div>

        {/* Persisted idempotency key tag */}
        <div className="text-[11px] text-[#74777d] font-mono break-all bg-[#F3F6FA] p-2 rounded-lg border border-[#D9E1EA]">
          <span className="font-bold">Idempotency Key:</span> {idempotencyKey}
        </div>

        {/* Test simulation failure toggle */}
        <label className="flex items-center gap-2 pt-1 text-xs text-[#44474c] cursor-pointer">
          <input
            type="checkbox"
            checked={simulateFailure}
            onChange={(e) => setSimulateFailure(e.target.checked)}
            className="rounded border-[#D9E1EA] text-[#0B1F33]"
          />
          <span>Simulate payment gateway failure (test retry flow)</span>
        </label>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-[#FDE8E8] text-xs text-[#D32F2F] flex flex-col gap-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <p className="text-[11px] text-[#D32F2F]/80">
              Your reservation is held. You can retry payment immediately using your existing request key.
            </p>
          </div>
        )}

        {paymentState === 'FAILED' ? (
          <button
            type="button"
            onClick={() => void handlePay()}
            className="w-full h-[52px] rounded-xl font-bold bg-[#D32F2F] text-white flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry payment (₹{totalFare})</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={paymentState === 'PROCESSING'}
            onClick={() => void handlePay()}
            className="w-full h-[52px] rounded-xl font-bold bg-[#F5A524] text-[#0B1F33] flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            {paymentState === 'PROCESSING' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing simulated payment…</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm payment · ₹{totalFare}</span>
              </>
            )}
          </button>
        )}
      </section>
    </div>
  );
};
