import React from 'react';
import { CloudUpload, RefreshCw } from 'lucide-react';
import type { OfflineBoardingItem } from '../types';

interface OfflineQueueBannerProps {
  queue: OfflineBoardingItem[];
  onSync: () => void;
  isSyncing: boolean;
  isOnline: boolean;
}

export const OfflineQueueBanner: React.FC<OfflineQueueBannerProps> = ({
  queue,
  onSync,
  isSyncing,
  isOnline,
}) => {
  if (queue.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border border-amber-600/40 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse-slow">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
          <CloudUpload className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <span>{queue.length} Offline {queue.length === 1 ? 'Scan' : 'Scans'} Cached</span>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-900 text-amber-200">
              Needs Sync
            </span>
          </h4>
          <p className="text-xs text-slate-300">
            {isOnline
              ? 'Internet connection restored. Synchronize local scans to update central manifest.'
              : 'Device is offline. Scans are saved securely on device and will sync when reconnected.'}
          </p>
        </div>
      </div>

      <button
        onClick={onSync}
        disabled={isSyncing || !isOnline}
        className="tap-target w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-amber-900/30 transition-all active:scale-95"
      >
        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
        <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
      </button>
    </div>
  );
};
