import React from 'react';
import { AlertTriangle, RefreshCw, Navigation, X } from 'lucide-react';

interface DepartWarningModalProps {
  isOpen: boolean;
  provisionalCount: number;
  onSyncAndDepart: () => void;
  onDepartAnyway: () => void;
  onCancel: () => void;
  isSyncing: boolean;
}

export const DepartWarningModal: React.FC<DepartWarningModalProps> = ({
  isOpen,
  provisionalCount,
  onSyncAndDepart,
  onDepartAnyway,
  onCancel,
  isSyncing,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4 pb-safe animate-fade-in">
      <div className="bg-slate-900 border border-amber-500/60 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-amber-950/80 border-b border-amber-900/60 p-4 sm:p-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 ring-4 ring-amber-500/10">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                Unsynced Provisional Scans!
              </h3>
              <p className="text-xs text-amber-300 mt-0.5">
                Departure Warning Checklist
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs sm:text-sm text-slate-300">
          <div className="bg-amber-950/30 border border-amber-900/50 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300">Unsynced Provisional Scans:</span>
              <span className="px-2.5 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs">
                {provisionalCount} {provisionalCount === 1 ? 'Scan' : 'Scans'}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              These scans were accepted locally on this device in offline mode and have <strong>not yet been confirmed</strong> by the central server.
            </p>
          </div>

          <p className="text-slate-300 leading-relaxed text-xs">
            Departing the station before syncing may cause discrepancies with central station logs and delay ticket status updates for waiting passengers.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row-reverse gap-2.5">
          <button
            onClick={onSyncAndDepart}
            disabled={isSyncing}
            className="tap-target flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 active-press transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now & Depart'}</span>
          </button>

          <button
            onClick={onDepartAnyway}
            disabled={isSyncing}
            className="tap-target py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold text-amber-300 hover:text-amber-200 bg-amber-950/50 hover:bg-amber-900/60 border border-amber-800/80 flex items-center justify-center gap-2 active-press transition-all"
          >
            <Navigation className="w-4 h-4" />
            <span>Depart Anyway</span>
          </button>

          <button
            onClick={onCancel}
            disabled={isSyncing}
            className="tap-target py-3 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
