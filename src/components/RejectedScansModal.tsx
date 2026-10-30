import React from 'react';
import { AlertOctagon, Check, Clock, Ticket } from 'lucide-react';
import type { ScanRecord } from '../types';

interface RejectedScansModalProps {
  isOpen: boolean;
  rejectedScans: ScanRecord[];
  onAcknowledgeAll: () => void;
  onDismiss: () => void;
}

export const RejectedScansModal: React.FC<RejectedScansModalProps> = ({
  isOpen,
  rejectedScans,
  onAcknowledgeAll,
  onDismiss,
}) => {
  if (!isOpen || rejectedScans.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4 pb-safe animate-fade-in">
      <div className="bg-slate-900 border border-rose-500/60 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-rose-950/80 border-b border-rose-900/60 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 ring-4 ring-rose-500/10">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                Rejected Scans Alert
              </h3>
              <p className="text-xs text-rose-300">
                {rejectedScans.length} scan{rejectedScans.length > 1 ? 's were' : ' was'} rejected and must be acknowledged
              </p>
            </div>
          </div>
        </div>

        {/* List of Rejected Scans */}
        <div className="p-4 overflow-y-auto space-y-3 divide-y divide-slate-800">
          {rejectedScans.map((scan) => (
            <div key={scan.client_scan_id} className="pt-3 first:pt-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-rose-400">
                  <Ticket className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{scan.ticket_reference || scan.ticket_id}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>{new Date(scan.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
              </div>

              {scan.passenger_name && (
                <div className="text-xs font-semibold text-slate-200">
                  Passenger: <span className="text-white">{scan.passenger_name}</span>
                </div>
              )}

              <div className="bg-rose-950/40 border border-rose-900/50 rounded-xl p-2.5 text-xs text-rose-200 leading-relaxed font-sans">
                <span className="font-bold text-rose-300">Reason: </span>
                {scan.reject_reason || 'Rejected by validation rules'}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center gap-2.5">
          <button
            onClick={onDismiss}
            className="flex-1 tap-target py-2.5 px-4 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Review Later
          </button>
          <button
            onClick={onAcknowledgeAll}
            className="flex-1 tap-target py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/60 active-press transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Acknowledge All</span>
          </button>
        </div>
      </div>
    </div>
  );
};
