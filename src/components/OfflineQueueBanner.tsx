import React from 'react';
import { RefreshCw, AlertTriangle, Layers, Clock } from 'lucide-react';
import type { ScanRecord } from '../types';

interface OfflineQueueBannerProps {
  provisionalScans: ScanRecord[];
  allScans: ScanRecord[];
  onSync: () => void;
  onOpenDetails: () => void;
  isSyncing: boolean;
  isOnline: boolean;
  backoffDelayMs?: number;
  retryAttempt?: number;
}

export const OfflineQueueBanner: React.FC<OfflineQueueBannerProps> = ({
  provisionalScans,
  onSync,
  onOpenDetails,
  isSyncing,
  isOnline,
  backoffDelayMs,
  retryAttempt,
}) => {
  const count = provisionalScans.length;
  if (count === 0 && !isSyncing) return null;

  return (
    <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 border border-amber-500/50 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5 transition-all animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
          <Clock className="w-5 h-5 text-amber-400" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center flex-wrap gap-2">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>{count} Provisional (Unsynced) {count === 1 ? 'Scan' : 'Scans'}</span>
            </h4>
            <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Not Server Validated
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
            {isOnline
              ? 'Network connection active. Local provisional scans need verification with server to update official manifest.'
              : 'Device operating in offline mode. Tickets verified against cached manifest only. They will reconcile upon reconnect.'}
          </p>

          {backoffDelayMs && backoffDelayMs > 0 && !isSyncing && (
            <div className="text-[11px] text-amber-300/90 font-mono flex items-center gap-1.5 pt-0.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                Retrying in {Math.round(backoffDelayMs / 1000)}s (Backoff attempt {retryAttempt})
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto shrink-0 pt-1 md:pt-0">
        <button
          onClick={onOpenDetails}
          type="button"
          className="tap-target flex-1 md:flex-none px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/80 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          title="Inspect scan queue"
        >
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span>Queue Log</span>
        </button>

        <button
          onClick={onSync}
          disabled={isSyncing || !isOnline}
          className="tap-target flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-amber-950/50 transition-all active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      </div>
    </div>
  );
};
