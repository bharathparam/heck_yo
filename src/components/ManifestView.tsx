import React, { useState, useMemo } from 'react';
import { Search, UserCheck, Check, RefreshCw, X, Users, Phone, Ticket, Clock } from 'lucide-react';
import type { PassengerManifestItem, ScanRecord } from '../types';

interface ManifestViewProps {
  manifest: PassengerManifestItem[];
  scans: ScanRecord[];
  onManualBoard: (ticketId: string, ticketRef: string, passengerName: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const ManifestView: React.FC<ManifestViewProps> = ({
  manifest,
  scans,
  onManualBoard,
  onRefresh,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'provisional' | 'boarded'>('all');

  // Compute item status by merging manifest and local scans queue
  const manifestWithQueueStatus = useMemo(() => {
    return manifest.map((item) => {
      // Find latest scan record in local queue for this ticket
      const localScan = scans.find(
        (s) => s.ticket_id === item.ticket_id || s.ticket_reference === item.ticket_reference
      );

      let effectiveStatus: 'BOARDED' | 'PROVISIONAL' | 'PENDING' = 'PENDING';

      if (item.status === 'BOARDED' && (!localScan || localScan.state === 'SERVER_VALIDATED')) {
        effectiveStatus = 'BOARDED';
      } else if (localScan?.state === 'LOCAL_ACCEPTED' || localScan?.state === 'SYNCING') {
        effectiveStatus = 'PROVISIONAL';
      } else if (localScan?.state === 'SERVER_VALIDATED') {
        effectiveStatus = 'BOARDED';
      } else if (item.status === 'BOARDED') {
        effectiveStatus = 'BOARDED';
      }

      return {
        ...item,
        effectiveStatus,
        localScan,
      };
    });
  }, [manifest, scans]);

  const filteredItems = useMemo(() => {
    return manifestWithQueueStatus.filter((item) => {
      const matchSearch =
        item.passenger_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.ticket_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.passenger_phone && item.passenger_phone.includes(searchTerm));

      if (!matchSearch) return false;

      if (filter === 'boarded') return item.effectiveStatus === 'BOARDED';
      if (filter === 'provisional') return item.effectiveStatus === 'PROVISIONAL';
      if (filter === 'pending') return item.effectiveStatus === 'PENDING';
      return true;
    });
  }, [manifestWithQueueStatus, searchTerm, filter]);

  const serverBoardedCount = manifestWithQueueStatus.filter((m) => m.effectiveStatus === 'BOARDED').length;
  const provisionalCount = manifestWithQueueStatus.filter((m) => m.effectiveStatus === 'PROVISIONAL').length;
  const pendingCount = manifestWithQueueStatus.filter((m) => m.effectiveStatus === 'PENDING').length;

  return (
    <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
      {/* Manifest Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              Passenger Manifest
              <span className="text-xs font-normal text-slate-400">({manifest.length})</span>
            </h3>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="tap-target w-9 h-9 p-0 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 border border-slate-800/80 flex items-center justify-center transition-all active-press"
          title="Refresh manifest"
          aria-label="Refresh manifest"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
        </button>
      </div>

      {/* Search Bar with Clear Button */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search passenger, seat, ticket #..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter Tabs with Distinct Status Badges */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] font-semibold">
        <button
          onClick={() => setFilter('all')}
          className={`py-2 px-1 rounded-lg transition-all text-center truncate ${
            filter === 'all'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All ({manifest.length})
        </button>

        <button
          onClick={() => setFilter('pending')}
          className={`py-2 px-1 rounded-lg transition-all text-center flex items-center justify-center gap-1 truncate ${
            filter === 'pending'
              ? 'bg-slate-800 text-slate-200 border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Pending</span>
          <span className="text-[10px] px-1 rounded bg-slate-700/80 text-slate-300">
            {pendingCount}
          </span>
        </button>

        <button
          onClick={() => setFilter('provisional')}
          className={`py-2 px-1 rounded-lg transition-all text-center flex items-center justify-center gap-1 truncate ${
            filter === 'provisional'
              ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80 shadow-sm'
              : 'text-amber-400/80 hover:text-amber-300'
          }`}
        >
          <span>Provisional</span>
          <span className="text-[10px] px-1 rounded bg-amber-500/20 text-amber-300">
            {provisionalCount}
          </span>
        </button>

        <button
          onClick={() => setFilter('boarded')}
          className={`py-2 px-1 rounded-lg transition-all text-center flex items-center justify-center gap-1 truncate ${
            filter === 'boarded'
              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 shadow-sm'
              : 'text-emerald-400/80 hover:text-emerald-300'
          }`}
        >
          <span>Validated</span>
          <span className="text-[10px] px-1 rounded bg-emerald-500/20 text-emerald-300">
            {serverBoardedCount}
          </span>
        </button>
      </div>

      {/* Manifest Passenger List */}
      <div className="space-y-2 max-h-[380px] sm:max-h-[460px] overflow-y-auto no-scrollbar pr-0.5">
        {filteredItems.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs space-y-1">
            <Users className="w-6 h-6 mx-auto text-slate-600 mb-1" />
            <p>No passengers found matching your search filter.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isBoarded = item.effectiveStatus === 'BOARDED';
            const isProvisional = item.effectiveStatus === 'PROVISIONAL';

            return (
              <div
                key={item.ticket_id}
                className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                  isBoarded
                    ? 'bg-emerald-950/15 border-emerald-900/40'
                    : isProvisional
                    ? 'bg-amber-950/20 border-amber-600/40'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-white truncate">
                      {item.passenger_name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono shrink-0">
                      {item.seat_count} {item.seat_count === 1 ? 'Seat' : 'Seats'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    <span className="text-sky-400 flex items-center gap-1">
                      <Ticket className="w-3 h-3 text-sky-500 shrink-0" />
                      {item.ticket_reference}
                    </span>
                    {item.passenger_phone && (
                      <span className="text-slate-500 hidden sm:inline-flex items-center gap-1">
                        • <Phone className="w-3 h-3 text-slate-600" />
                        {item.passenger_phone}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {isBoarded ? (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-1.5 rounded-lg">
                      <Check className="w-3.5 h-3.5" />
                      <span>Verified Boarded</span>
                    </div>
                  ) : isProvisional ? (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-950/80 border border-amber-600/70 px-2.5 py-1.5 rounded-lg shadow-sm">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Provisional</span>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        onManualBoard(item.ticket_id, item.ticket_reference, item.passenger_name)
                      }
                      className="tap-target px-3 py-1.5 text-xs font-bold text-sky-300 bg-sky-950/70 hover:bg-sky-900/80 border border-sky-800/70 rounded-xl flex items-center gap-1.5 active-press transition-all"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Check In</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
