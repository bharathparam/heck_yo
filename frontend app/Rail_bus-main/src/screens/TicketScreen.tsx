import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Share2, Download, CheckCircle2, WifiOff, AlertTriangle } from 'lucide-react';
import { TicketQRRenderer } from '../components/ticket/TicketQRRenderer';
import { api, getOfflineTickets } from '../services/api';
import type { Booking } from '../types';

export const TicketScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, bookings, isOnline } = useApp();

  const [activeBooking, setActiveBooking] = useState<Booking | null>(() => {
    return bookings.find((b) => b.id === id || b.booking_reference === id) || bookings[0] || null;
  });
  const [copyFeedback, setCopyFeedback] = useState('');
  const [loading, setLoading] = useState(!activeBooking);

  useEffect(() => {
    let alive = true;
    const fetchBooking = async () => {
      if (!id) return;
      try {
        if (!isOnline) {
          const offlineBookings = await getOfflineTickets();
          const match = offlineBookings.find((b) => b.id === id || b.booking_reference === id) || offlineBookings[0];
          if (alive && match) setActiveBooking(match);
          return;
        }
        const serverBooking = await api.getTicket(id);
        if (alive && serverBooking) {
          setActiveBooking(serverBooking);
        }
      } catch (err) {
        console.warn('[TicketScreen] Fallback to cached tickets:', err);
        const offlineBookings = await getOfflineTickets();
        const match = offlineBookings.find((b) => b.id === id || b.booking_reference === id);
        if (alive && match) setActiveBooking(match);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void fetchBooking();
    return () => {
      alive = false;
    };
  }, [id, isOnline]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4 pt-20">
        <div className="w-8 h-8 rounded-full border-2 border-[#0B1F33] border-t-transparent animate-spin" />
        <p className="text-sm text-[#74777d]">Loading ticket details…</p>
      </div>
    );
  }

  if (!activeBooking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4 pt-20">
        <p className="text-sm text-[#74777d]">No active ticket or reservation found.</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-xl bg-[#0B1F33] text-white text-xs font-bold"
        >
          Book a Bus
        </button>
      </div>
    );
  }

  const isUsedState = activeBooking.status === 'BOARDED';
  const hasTicket = Boolean(activeBooking.ticket && activeBooking.ticket.ticket_reference);

  const handleShare = () => {
    const code = activeBooking.ticket?.ticket_reference || activeBooking.booking_reference;
    if (navigator.share) {
      navigator.share({
        title: `RailBus Ticket: ${code}`,
        text: `RailBus pass for ${activeBooking.destination_stop?.stop_name || activeBooking.route_name}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      void navigator.clipboard?.writeText(code).catch(() => {});
      setCopyFeedback('Booking reference copied to clipboard!');
      setTimeout(() => setCopyFeedback(''), 2500);
    }
  };

  const handleSaveToPhone = () => {
    const code = activeBooking.ticket?.ticket_reference || activeBooking.booking_reference;
    void navigator.clipboard?.writeText(code).catch(() => {});
    setCopyFeedback('Ticket reference saved for offline verification.');
    setTimeout(() => setCopyFeedback(''), 2500);
  };

  return (
    <div className="flex flex-col w-full max-w-md mx-auto space-y-4 pb-28 pt-20 px-4">
      {/* Top Bar with Title and Back */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/tickets')}
          className="w-10 h-10 rounded-full bg-white border border-[#D9E1EA] flex items-center justify-center text-[#0B1F33] active:scale-95 transition-transform shadow-sm"
          title="Back to Tickets"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-xl text-[#0B1F33] tracking-tight">
          {hasTicket ? t.ticket.title : 'Reservation Status'}
        </h1>
        <div className="w-10" />
      </div>

      {/* Offline banner check for offline tickets */}
      {!isOnline && (
        <div
          role="status"
          className="p-3 bg-[#FFF4E5] border border-[#B76E00]/40 rounded-xl text-xs font-bold text-[#B76E00] flex items-center gap-2 shadow-sm"
        >
          <WifiOff className="w-4 h-4 shrink-0 text-[#B76E00]" />
          <span>Offline copy, not validated</span>
        </div>
      )}

      {/* Main Boarding Pass Card / Waiting for bus card */}
      <TicketQRRenderer booking={activeBooking} isUsed={isUsedState} isOffline={!isOnline} />

      {/* Copy Feedback Toast */}
      {copyFeedback && (
        <div className="p-3 bg-[#E6F4EA] border border-[#0B7A55]/30 rounded-xl text-xs font-semibold text-[#0B7A55] text-center flex items-center justify-center gap-1.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{copyFeedback}</span>
        </div>
      )}

      {/* Actions */}
      {hasTicket && !isUsedState && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={handleSaveToPhone}
            className="h-12 px-3 rounded-xl border border-[#D9E1EA] bg-white text-[#0B1F33] font-semibold text-xs flex items-center justify-center gap-2 shadow-sm hover:bg-[#F3F6FA] active:scale-95 transition-all"
          >
            <Download className="w-4 h-4 text-[#0B1F33]" />
            <span>Save Offline</span>
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="h-12 px-3 rounded-xl border border-[#D9E1EA] bg-white text-[#0B1F33] font-semibold text-xs flex items-center justify-center gap-2 shadow-sm hover:bg-[#F3F6FA] active:scale-95 transition-all"
          >
            <Share2 className="w-4 h-4 text-[#0B1F33]" />
            <span>{t.ticket.shareBtn}</span>
          </button>
        </div>
      )}
    </div>
  );
};
