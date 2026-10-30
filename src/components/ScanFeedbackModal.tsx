import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, ArrowRight } from 'lucide-react';

export interface FeedbackData {
  type: 'success' | 'error' | 'offline_saved';
  title: string;
  message: string;
  passengerName?: string;
  ticketReference?: string;
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
    }, 2800);
    return () => clearTimeout(timer);
  }, [data, onDismiss]);

  if (!data) return null;

  const isSuccess = data.type === 'success';
  const isOffline = data.type === 'offline_saved';
  const isError = data.type === 'error';

  return (
    <div
      onClick={onDismiss}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4 cursor-pointer pb-safe animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-3xl p-5 sm:p-6 text-center space-y-3.5 shadow-2xl border transition-all ${
          isSuccess
            ? 'bg-slate-900 border-emerald-500/60 shadow-emerald-950/60'
            : isOffline
            ? 'bg-slate-900 border-amber-500/60 shadow-amber-950/60'
            : 'bg-slate-900 border-rose-500/60 shadow-rose-950/60'
        }`}
      >
        {/* Status Icon */}
        <div className="flex justify-center">
          {isSuccess && (
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center ring-8 ring-emerald-500/10">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          )}
          {isOffline && (
            <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center ring-8 ring-amber-500/10">
              <Clock className="w-8 h-8" />
            </div>
          )}
          {isError && (
            <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center ring-8 ring-rose-500/10 animate-bounce">
              <XCircle className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Title and Message */}
        <div className="space-y-1">
          <h3
            className={`text-lg sm:text-xl font-bold tracking-tight ${
              isSuccess ? 'text-emerald-400' : isOffline ? 'text-amber-400' : 'text-rose-400'
            }`}
          >
            {data.title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">{data.message}</p>
        </div>

        {/* Passenger Meta Card */}
        {data.passengerName && (
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-left space-y-0.5">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Passenger</div>
            <div className="text-sm font-bold text-white truncate">{data.passengerName}</div>
            {data.ticketReference && (
              <div className="text-xs font-mono font-semibold text-sky-400">{data.ticketReference}</div>
            )}
          </div>
        )}

        {/* Boarding Counter Update */}
        {data.boardedCount !== undefined && data.totalPassengers !== undefined && (
          <div className="text-xs text-slate-400 font-mono">
            Trip Progress:{' '}
            <span className="text-emerald-400 font-bold">{data.boardedCount}</span> /{' '}
            {data.totalPassengers} Boarded
          </div>
        )}

        <button
          onClick={onDismiss}
          className="w-full tap-target bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 active-press transition-colors border border-slate-700"
        >
          <span>Tap to Scan Next</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
