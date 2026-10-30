import React from 'react';
import { X, Clock, CheckCircle2, XCircle, RefreshCw, Layers } from 'lucide-react';
import type { ScanRecord } from '../types';

interface QueueDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  scans: ScanRecord[];
  onSyncNow: () => void;
  isSyncing: boolean;
  isOnline: boolean;
}

export const QueueDetailsModal: React.FC<QueueDetailsModalProps> = ({
  isOpen,
  onClose,
  scans,
  onSyncNow,
  isSyncing,
  isOnline,
}) => {
  if (!isOpen) return null;

  const renderStateBadge = (state: ScanRecord['state']) => {
    switch (state) {
      case 'LOCAL_ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <Clock className="w-3 h-3 text-amber-400" />
            PROVISIONAL (OFFLINE)
          </span>
        );
      case 'SYNCING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
            <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />
            SYNCING...
          </span>
        );
      case 'SERVER_VALIDATED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            SERVER VALIDATED
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            <XCircle className="w-3 h-3 text-rose-400" />
            REJECTED
          </span>
        );
    }
  };

  const provisionalCount = scans.filter((s) => s.state === 'LOCAL_ACCEPTED').length;
  const validatedCount = scans.filter((s) => s.state === 'SERVER_VALIDATED').length;
  const rejectedCount = scans.filter((s) => s.state === 'REJECTED').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4 pb-safe animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                IndexedDB Scan Queue Log
              </h3>
              <p className="text-[11px] text-slate-400">
                Persistent offline queue & audit trail
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Counter Summary Pills */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto text-[11px] font-mono">
          <span className="text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-900/60 shrink-0">
            Provisional: <strong>{provisionalCount}</strong>
          </span>
          <span className="text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-900/60 shrink-0">
            Validated: <strong>{validatedCount}</strong>
          </span>
          <span className="text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded border border-rose-900/60 shrink-0">
            Rejected: <strong>{rejectedCount}</strong>
          </span>
        </div>

        {/* Scan List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-slate-800/60">
          {scans.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              No scans recorded yet for this trip.
            </div>
          ) : (
            scans.map((scan) => (
              <div key={scan.client_scan_id} className="pt-2.5 first:pt-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-sky-300">
                    {scan.ticket_reference || scan.ticket_id}
                  </span>
                  {renderStateBadge(scan.state)}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate text-slate-300">
                    {scan.passenger_name || 'Passenger'}
                  </span>
                  <span className="font-mono text-slate-500 shrink-0">
                    {new Date(scan.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>

                {scan.reject_reason && (
                  <div className="text-[11px] text-rose-300 bg-rose-950/30 border border-rose-900/40 rounded px-2 py-1">
                    {scan.reject_reason}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-2">
          <button
            onClick={onSyncNow}
            disabled={isSyncing || !isOnline || provisionalCount === 0}
            className="tap-target px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-40 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Pending'}</span>
          </button>

          <button
            onClick={onClose}
            className="tap-target px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
