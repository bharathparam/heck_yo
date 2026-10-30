import React from 'react';
import { WifiOff, CheckCircle, AlertTriangle, ShieldCheck, Bus, Clock } from 'lucide-react';
import type { Booking } from '../../types';
import { useApp } from '../../context/AppContext';

interface TicketQRRendererProps {
  booking: Booking;
  isUsed?: boolean;
  isOffline?: boolean;
}

export const TicketQRRenderer: React.FC<TicketQRRendererProps> = ({ booking, isUsed = false, isOffline = false }) => {
  const { t } = useApp();
  const ticket = booking.ticket;
  const isCancelled = booking.status === 'CANCELLED' || booking.status === 'REFUNDED';
  const isWaiting = booking.status === 'WAITING_DISPATCH' || !ticket;

  const destName = booking.destination_stop?.stop_name || booking.route_name;
  const travelDate = booking.trip?.travel_date || (booking.trip?.departure_time ? booking.trip.departure_time.slice(0, 10) : '—');

  // If waiting for bus assignment, show the dedicated "reserved, waiting for bus" card
  if (isWaiting && !isCancelled) {
    const demandCount = booking.trip?.demand_count || booking.trip?.confirmed_bookings_count || 1;
    const targetThreshold = booking.trip?.target_threshold || 20;
    const progressPct = Math.min(100, (demandCount / targetThreshold) * 100);

    return (
      <div className="relative w-full rounded-2xl bg-white border border-[#D9E1EA] shadow-[0_4px_20px_rgba(11,31,51,0.06)] overflow-hidden">
        <div className="w-full h-1.5 bg-[#F5A524]" />
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-1 rounded-full bg-[#EBF2FA] text-[#0B1F33] font-bold text-xs uppercase tracking-wider">
              KSRTC Feeder
            </span>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF4E5] text-[#B76E00]">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">Reserved · waiting for bus</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-[#74777d]">Boarding from Mysuru Junction</div>
            <h2 className="text-xl font-bold text-[#0B1F33]">
              Mysuru Junction &rarr; {destName}
            </h2>
            <p className="text-xs text-[#74777d]">
              Connected to Train {booking.trip?.train_number || '—'} · Travel Date: {travelDate}
            </p>
          </div>

          {/* Demand Status Box */}
          <div className="rounded-xl bg-[#F3F6FA] p-3.5 border border-[#D9E1EA] space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold flex items-center gap-1.5 text-[#0B1F33]">
                <Bus className="w-4 h-4 text-[#0B7A55]" />
                Demand: {demandCount} / {targetThreshold} confirmed seats
              </span>
              <span className="font-bold text-[#0B7A55]">
                {Math.max(0, targetThreshold - demandCount)} more needed
              </span>
            </div>
            <div className="h-2 bg-white rounded-full overflow-hidden border border-[#D9E1EA]">
              <div
                className="h-full bg-[#0B7A55] rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[11px] text-[#44474c] leading-relaxed">
              Your {booking.seat_count} seat(s) are paid and secured. A bus will be scheduled and dispatched once the 20-seat threshold is achieved.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs bg-[#F3F6FA] p-3 rounded-xl border border-[#D9E1EA]">
            <div>
              <span className="block text-[10px] text-[#74777d] uppercase font-bold">Booking Ref</span>
              <span className="font-mono font-bold text-[#0B1F33]">{booking.booking_reference}</span>
            </div>
            <div>
              <span className="block text-[10px] text-[#74777d] uppercase font-bold">Paid Amount</span>
              <span className="font-mono font-bold text-[#0B1F33]">₹{booking.fare_amount}</span>
            </div>
          </div>

          <div className="rounded-xl bg-[#FFF4E5] border border-[#F5A524]/40 p-3.5 text-xs text-[#B76E00] flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <b>Boarding pass notice:</b> Your QR ticket will appear here as soon as Admin confirms bus dispatch. If the service is cancelled due to insufficient demand, a full refund will be processed automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Assigned / Issued Ticket View
  return (
    <div className="relative w-full rounded-2xl bg-white border border-[#D9E1EA] shadow-[0_4px_20px_rgba(11,31,51,0.06)] overflow-hidden">
      {/* Accent top edge */}
      <div className={`w-full h-1.5 ${isCancelled ? 'bg-[#D32F2F]' : isUsed ? 'bg-[#74777d]' : 'bg-[#0B7A55]'}`} />

      {/* TOP HALF: Transit Details */}
      <div className="p-5 pt-4">
        {/* Status Pill */}
        <div className="flex items-center justify-between mb-3">
          <span className="px-2.5 py-1 rounded-full bg-[#EBF2FA] text-[#0B1F33] font-bold text-xs uppercase tracking-wider">
            KSRTC Feeder
          </span>
          {isCancelled ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDE8E8] text-[#D32F2F]">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">Service Cancelled</span>
            </div>
          ) : isUsed ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E1E9F2] text-[#44474c]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">{t.ticket.alreadyUsed}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6F4EA] text-[#0B7A55]">
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">Bus Assigned · Boarding Pass</span>
            </div>
          )}
        </div>

        {/* Departure Time & Destination */}
        <div className="flex items-baseline justify-between mb-1">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-[#0B1F33] font-mono tracking-tight">
              Train {booking.trip?.train_number || '12614'}
            </span>
            <span className="text-[#74777d] text-sm">&rarr;</span>
            <span className="text-lg font-bold text-[#0B1F33]">{destName}</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-[#EBF2FA] text-[#0B1F33] font-semibold text-xs tracking-wider">
            {booking.trip?.bus_registration || 'Bus Assigned'}
          </span>
        </div>
        <p className="text-xs text-[#74777d] mb-4">
          Mysuru Junction to {destName} · Conductor: {booking.trip?.conductor_name || 'Assigned'}
        </p>

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-[#F3F6FA] text-xs">
          <div>
            <span className="block text-[10px] font-semibold text-[#74777d] uppercase tracking-wider">{t.ticket.dateLabel}</span>
            <span className="font-semibold text-[#0B1F33]">{travelDate}</span>
          </div>
          <div>
            <span className="block text-[10px] font-semibold text-[#74777d] uppercase tracking-wider">{t.ticket.seatsLabel}</span>
            <span className="font-semibold text-[#0B1F33]">{booking.seat_count} Seat{booking.seat_count > 1 ? 's' : ''}</span>
          </div>
          <div>
            <span className="block text-[10px] font-semibold text-[#74777d] uppercase tracking-wider">Paid fare</span>
            <span className="font-bold text-[#0B1F33] font-mono">₹{booking.fare_amount}</span>
          </div>
        </div>
      </div>

      {/* Ticket Cutout Notch */}
      <div className="relative w-full h-6 flex items-center bg-white">
        <div className="absolute -left-3 w-6 h-6 rounded-full bg-[#F3F6FA] border-r border-[#D9E1EA]" />
        <div className="w-full mx-5 border-b border-dashed border-[#D9E1EA]" />
        <div className="absolute -right-3 w-6 h-6 rounded-full bg-[#F3F6FA] border-l border-[#D9E1EA]" />
      </div>

      {/* BOTTOM HALF: QR Code & Verification */}
      <div className="px-5 pt-3 pb-6 flex flex-col items-center text-center bg-white">
        <div className="relative p-3 rounded-2xl bg-white border border-[#D9E1EA] shadow-sm mb-3">
          {ticket?.qr_data_url ? (
            <img
              src={ticket.qr_data_url}
              alt={`Ticket QR ${ticket.ticket_reference}`}
              className={`w-[180px] h-[180px] object-contain ${isCancelled || isUsed ? 'opacity-25' : ''}`}
            />
          ) : (
            <svg
              className={`w-[180px] h-[180px] text-[#0B1F33] ${isCancelled || isUsed ? 'opacity-25' : ''}`}
              viewBox="0 0 160 160"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="160" height="160" fill="#FFFFFF" />
              <rect x="12" y="12" width="40" height="40" rx="3" fill="currentColor" />
              <rect x="18" y="18" width="28" height="28" fill="#FFFFFF" />
              <rect x="24" y="24" width="16" height="16" fill="currentColor" />
              <rect x="108" y="12" width="40" height="40" rx="3" fill="currentColor" />
              <rect x="114" y="18" width="28" height="28" fill="#FFFFFF" />
              <rect x="120" y="24" width="16" height="16" fill="currentColor" />
              <rect x="12" y="108" width="40" height="40" rx="3" fill="currentColor" />
              <rect x="18" y="114" width="28" height="28" fill="#FFFFFF" />
              <rect x="24" y="120" width="16" height="16" fill="currentColor" />
              <path d="M58 20h6v6h-6zm12 0h6v6h-6zm12 0h6v6h-6zm0 12h6v6h-6zm-12 12h6v6h-6zm-12 0h6v6h-6zm-18 12h6v6h-6zm12 0h6v6h-6zm12 0h6v6h-6zm12 0h6v6h-6zm12 0h6v6h-6zm12 0h6v6h-6zm12 0h6v6h-6z" fill="currentColor" />
              <path d="M20 58h6v6h-6zm0 12h6v6h-6zm0 12h6v6h-6zm12 12h6v6h-6zm24-24h6v6h-6zm12 0h6v6h-6zm12 0h6v6h-6zm0-12h6v6h-6zm12 12h6v6h-6zm12 0h6v6h-6zm-24 12h6v6h-6zm12 0h6v6h-6zm-36 0h6v6h-6zm0 12h6v6h-6zm12 12h6v6h-6zm12 0h6v6h-6zm24 0h6v6h-6z" fill="currentColor" />
              <path d="M58 108h6v6h-6zm12 0h6v6h-6zm0 12h6v6h-6zm12 0h6v6h-6zm0 12h6v6h-6zm12-12h6v6h-6zm12 0h6v6h-6zm12 12h6v6h-6zm-24 12h6v6h-6zm24 0h6v6h-6zm12 0h6v6h-6zm-36 12h6v6h-6zm12 0h6v6h-6zm24 0h6v6h-6zm-72-12h6v6h-6zm12 0h6v6h-6zm-12 12h6v6h-6z" fill="currentColor" />
              <path d="M96 28h8v8h-8zm0 16h8v8h-8zm-28 64h8v8h-8zm16 16h8v8h-8zm32-40h8v8h-8zm0 16h8v8h-8zm-16 0h8v8h-8zm32 16h8v8h-8z" fill="currentColor" />
            </svg>
          )}

          {/* Watermark for used or cancelled */}
          {(isCancelled || isUsed) && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-[1px] rounded-2xl">
              <div
                className={`px-4 py-2 rounded-xl border-2 font-bold text-lg tracking-widest uppercase rotate-[-12deg] shadow-sm ${
                  isCancelled
                    ? 'border-[#D32F2F] text-[#D32F2F] bg-[#FDE8E8]'
                    : 'border-[#0B1F33] text-[#0B1F33] bg-[#E1E9F2]'
                }`}
              >
                {isCancelled ? 'CANCELLED' : 'USED'}
              </div>
            </div>
          )}
        </div>

        {/* Ticket Reference Code */}
        <div className="font-mono text-2xl font-bold text-[#0B1F33] tracking-[0.16em] mb-1 select-all">
          {ticket ? ticket.ticket_reference : booking.booking_reference}
        </div>

        {/* Conductor Instruction */}
        <p className="text-xs text-[#74777d] font-medium max-w-xs">
          {isCancelled
            ? 'This service was cancelled because demand did not reach 20 seats.'
            : isUsed
              ? 'This ticket was already scanned and validated by the conductor.'
              : t.ticket.conductorInstruction}
        </p>

        {/* Offline Status Footer Note */}
        <div className="flex items-center gap-1.5 mt-4 text-[11px] text-[#74777d] bg-[#F3F6FA] px-3 py-1.5 rounded-full border border-[#D9E1EA]">
          <WifiOff className="w-3.5 h-3.5 text-[#74777d]" />
          <span>{isOffline ? 'Offline copy, not validated' : t.ticket.offlineReady}</span>
        </div>
      </div>
    </div>
  );
};
