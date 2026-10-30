import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, ArrowRight, AlertTriangle } from 'lucide-react';
import type { ScanState } from '../types';

export interface FeedbackData {
  type: 'server_validated' | 'local_accepted' | 'rejected' | 'info';
  title: string;
  message: string;
  state?: ScanState;
  passengerName?: string;
  ticketReference?: string;
  seatCount?: number;
  rejectReason?: string;
  boardedCount?: number;
  totalPassengers?: number;
}

interface ScanFeedbackModalProps {
  data: FeedbackData | null;
  onDismiss: () => void;
}

export const ScanFeedbackModal: React.FC<ScanFeedbackModalProps> = ({ data, onDismiss }) => {
  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 3200);
    return () => clearTimeout(timer);
  }, [data, onDismiss]);

  if (!data) return null;

  const isServerValidated = data.type === 'server_validated';
  const isLocalAccepted = data.type === 'local_accepted';
  const isRejected = data.type === 'rejected';

  return (
    <div
      onClick={onDismiss}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4 cursor-pointer pb-safe animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-3xl p-5 sm:p-6 text-center space-y-3.5 shadow-2xl border transition-all ${
          isServerValidated
            ? 'bg-slate-900 border-emerald-500/60 shadow-emerald-950/60'
            : isLocalAccepted
            ? 'bg-slate-900 border-amber-500/60 shadow-amber-950/60'
            : isRejected
            ? 'bg-slate-900 border-rose-500/60 shadow-rose-950/60'
            : 'bg-slate-900 border-sky-500/60 shadow-sky-950/60'
        }`}
      >
        {/* Status Icon */}
        <div className="flex justify-center">
          {isServerValidated && (
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center ring-8 ring-emerald-500/10">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          )}
          {isLocalAccepted && (
            <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center ring-8 ring-amber-500/10">
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
          )}
          {isRejected && (
            <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center ring-8 ring-rose-500/10 animate-bounce">
              <XCircle className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Status Tag Pill */}
        <div className="flex justify-center">
          {isServerValidated && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              SERVER VALIDATED
            </span>
          )}
          {isLocalAccepted && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              LOCAL ACCEPTED (PROVISIONAL)
            </span>
          )}
          {isRejected && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
              VALIDATION REJECTED
            </span>
          )}
        </div>

        {/* Title and Message */}
        <div className="space-y-1">
          <h3
            className={`text-lg sm:text-xl font-bold tracking-tight ${
              isServerValidated
                ? 'text-emerald-400'
                : isLocalAccepted
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {data.title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
            {data.message}
          </p>
        </div>

        {/* Passenger Meta Card */}
        {data.passengerName && (
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-left space-y-0.5">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Passenger
            </div>
            <div className="text-sm font-bold text-white truncate flex items-center justify-between">
              <span>{data.passengerName}</span>
              {data.seatCount && (
                <span className="text-xs font-mono text-slate-400">
                  {data.seatCount} {data.seatCount === 1 ? 'seat' : 'seats'}
                </span>
              )}
            </div>
            {data.ticketReference && (
              <div className="text-xs font-mono font-semibold text-sky-400">
                {data.ticketReference}
              </div>
            )}
          </div>
        )}

        {/* Reject Reason Callout */}
        {data.rejectReason && (
          <div className="bg-rose-950/50 border border-rose-900/60 rounded-xl p-2.5 text-xs text-rose-200 text-left font-sans">
            <span className="font-bold text-rose-300">Reason: </span>
            {data.rejectReason}
          </div>
        )}

        {/* Boarding Counter Update */}
        {data.boardedCount !== undefined && data.totalPassengers !== undefined && (
          <div className="text-xs text-slate-400 font-mono">
            Trip Intake:{' '}
            <span className="text-emerald-400 font-bold">{data.boardedCount}</span> /{' '}
            {data.totalPassengers} Verified Boarded
          </div>
        )}

        <button
          onClick={onDismiss}
          className="w-full tap-target bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 active-press transition-colors border border-slate-700"
        >
          <span>Tap to Continue</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
