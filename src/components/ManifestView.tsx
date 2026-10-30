import React, { useState, useMemo } from 'react';
import { Search, UserCheck, Check, RefreshCw, X, Users, Phone, Ticket } from 'lucide-react';
import type { PassengerManifestItem } from '../types';

interface ManifestViewProps {
  manifest: PassengerManifestItem[];
  onManualBoard: (ticketId: string, ticketRef: string, passengerName: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const ManifestView: React.FC<ManifestViewProps> = ({
  manifest,
  onManualBoard,
  onRefresh,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'boarded' | 'pending'>('all');

  const filteredItems = useMemo(() => {
    return manifest.filter((item) => {
      const matchSearch =
        item.passenger_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.ticket_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.passenger_phone && item.passenger_phone.includes(searchTerm));

      if (!matchSearch) return false;

      if (filter === 'boarded') return item.status === 'BOARDED';
      if (filter === 'pending') return item.status !== 'BOARDED';
      return true;
    });
  }, [manifest, searchTerm, filter]);

  const boardedCount = manifest.filter((m) => m.status === 'BOARDED').length;
  const pendingCount = manifest.length - boardedCount;

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

      {/* Filter Tabs */}
      <div className="flex gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-2 rounded-lg transition-all text-center ${
            filter === 'all'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All ({manifest.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`flex-1 py-2 rounded-lg transition-all text-center flex items-center justify-center gap-1 ${
            filter === 'pending'
              ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Pending</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300">
            {pendingCount}
          </span>
        </button>
        <button
          onClick={() => setFilter('boarded')}
          className={`flex-1 py-2 rounded-lg transition-all text-center flex items-center justify-center gap-1 ${
            filter === 'boarded'
              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Boarded</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300">
            {boardedCount}
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
            const isBoarded = item.status === 'BOARDED';

            return (
              <div
                key={item.ticket_id}
                className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                  isBoarded
                    ? 'bg-emerald-950/15 border-emerald-900/40'
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
                      <span>Boarded</span>
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
