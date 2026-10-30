import React from 'react';
import {
  MapPin,
  CheckCircle2,
  ChevronRight,
  Play,
  Navigation,
  Flag,
  QrCode,
  Bus,
  Clock,
} from 'lucide-react';
import type { ConductorTripSummary, TripStatus } from '../types';

interface TripCardProps {
  trip: ConductorTripSummary;
  serverValidatedCount: number;
  provisionalCount: number;
  onOpenBoarding: () => void;
  onDepart: () => void;
  onComplete: () => void;
  onOpenScanner: () => void;
  isActionLoading?: boolean;
}

export const TripCard: React.FC<TripCardProps> = ({
  trip,
  serverValidatedCount,
  provisionalCount,
  onOpenBoarding,
  onDepart,
  onComplete,
  onOpenScanner,
  isActionLoading = false,
}) => {
  const total = trip.total_confirmed_passengers || 0;
  // Official server verified percentage
  const percentValidated = total > 0 ? Math.min(100, Math.round((serverValidatedCount / total) * 100)) : 0;
  // Provisional unverified percentage
  const percentProvisional = total > 0 ? Math.min(100 - percentValidated, Math.round((provisionalCount / total) * 100)) : 0;

  const getStatusBadge = (status: TripStatus) => {
    switch (status) {
      case 'BOARDING':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5 animate-pulse shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            BOARDING ACTIVE
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
            SCHEDULED
          </span>
        );
      case 'DEPARTED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center gap-1.5 shrink-0">
            <Navigation className="w-3 h-3" />
            IN TRANSIT (DEPARTED)
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-600/20 text-slate-400 border border-slate-600/40 flex items-center gap-1.5 shrink-0">
            <CheckCircle2 className="w-3 h-3" />
            COMPLETED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-700/50 text-slate-300 shrink-0">
            {status}
          </span>
        );
    }
  };

  // State guards based on backend constraints
  const canOpenBoarding = trip.status === 'SCHEDULED';
  const canScan = trip.status === 'BOARDING' || trip.status === 'SCHEDULED';
  const canDepart = trip.status === 'BOARDING';
  const canComplete = trip.status === 'DEPARTED';

  return (
    <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Route & Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase font-bold tracking-wider text-sky-400/90 mb-0.5">
            ASSIGNED DUTY
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
            {trip.route_name}
          </h2>
        </div>
        {getStatusBadge(trip.status)}
      </div>

      {/* Origin -> Destination Banner */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase font-semibold text-slate-400">Origin</div>
            <div className="text-xs sm:text-sm font-bold text-slate-200 truncate">{trip.origin}</div>
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />

        <div className="flex items-center gap-2 text-right justify-end min-w-0">
          <div className="min-w-0">
            <div className="text-[10px] uppercase font-semibold text-slate-400">Destination</div>
            <div className="text-xs sm:text-sm font-bold text-slate-200 truncate">{trip.destination}</div>
          </div>
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Honest Validation Counters Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {/* Bus Reg */}
        <div className="bg-slate-950/50 p-2.5 sm:p-3 rounded-xl border border-slate-800/80">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
            <Bus className="w-3.5 h-3.5 text-sky-400" />
            <span>Assigned Bus</span>
          </div>
          <div className="text-xs sm:text-sm font-mono font-bold text-white mt-1 truncate">
            {trip.bus_registration || 'Bus #101'}
          </div>
        </div>

        {/* Server Validated Count (Honest count) */}
        <div className="bg-emerald-950/20 p-2.5 sm:p-3 rounded-xl border border-emerald-900/40">
          <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Server Validated</span>
          </div>
          <div className="text-xs sm:text-sm font-bold text-white mt-1 flex items-baseline gap-1">
            <span className="text-emerald-400 text-sm sm:text-base font-mono">{serverValidatedCount}</span>
            <span className="text-slate-400 font-normal">/ {total} confirmed</span>
          </div>
        </div>

        {/* Provisional Unsynced Count (Never shown as validated) */}
        <div className={`p-2.5 sm:p-3 rounded-xl border col-span-2 sm:col-span-1 transition-all ${
          provisionalCount > 0
            ? 'bg-amber-950/30 border-amber-500/40'
            : 'bg-slate-950/50 border-slate-800/80'
        }`}>
          <div className="text-[11px] text-amber-400 flex items-center gap-1.5 font-medium">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Provisional (Local)</span>
          </div>
          <div className="text-xs sm:text-sm font-bold text-white mt-1 flex items-baseline gap-1">
            <span className="text-amber-400 text-sm sm:text-base font-mono">{provisionalCount}</span>
            <span className="text-slate-400 text-[11px] font-normal">unsynced scans</span>
          </div>
        </div>
      </div>

      {/* Segmented Dual-Progress Bar (Green for Validated, Amber for Provisional) */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Validated ({percentValidated}%)
            </span>
            {provisionalCount > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Provisional ({percentProvisional}%)
              </span>
            )}
          </div>
          <span className="text-slate-300 font-mono font-semibold">
            {serverValidatedCount + provisionalCount} / {total} Total
          </span>
        </div>

        <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800/80 flex">
          {/* Server Validated Bar */}
          <div
            className="bg-emerald-500 h-full transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
            style={{ width: `${percentValidated}%` }}
            title={`Server Validated: ${serverValidatedCount}`}
          ></div>
          {/* Provisional Scans Segment */}
          {provisionalCount > 0 && (
            <div
              className="bg-amber-500 h-full transition-all duration-500 opacity-90 border-l border-slate-950"
              style={{ width: `${percentProvisional}%` }}
              title={`Provisional Scans: ${provisionalCount}`}
            ></div>
          )}
        </div>
      </div>

      {/* Primary Action Buttons (Backend State Enforced) */}
      <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
        {trip.status === 'SCHEDULED' && (
          <button
            onClick={onOpenBoarding}
            disabled={!canOpenBoarding || isActionLoading}
            className="w-full tap-target bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 active-press transition-all text-xs sm:text-sm"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Open Boarding Window</span>
          </button>
        )}

        {trip.status === 'BOARDING' && (
          <>
            <button
              onClick={onOpenScanner}
              disabled={!canScan}
              className="flex-1 tap-target bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-40 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-sky-950/60 active-press transition-all text-xs sm:text-sm"
            >
              <QrCode className="w-5 h-5" />
              <span>Scan QR Tickets</span>
            </button>

            <button
              onClick={onDepart}
              disabled={!canDepart || isActionLoading}
              className={`tap-target border font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 active-press transition-all text-xs sm:text-sm ${
                provisionalCount > 0
                  ? 'bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border-amber-600/60 shadow-lg shadow-amber-950/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-800/60'
              }`}
            >
              <Navigation className="w-4 h-4" />
              <span>Depart Bus</span>
              {provisionalCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              )}
            </button>
          </>
        )}

        {trip.status === 'DEPARTED' && (
          <button
            onClick={onComplete}
            disabled={!canComplete || isActionLoading}
            className="w-full tap-target bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/50 active-press transition-all text-xs sm:text-sm"
          >
            <Flag className="w-4 h-4" />
            <span>Mark Trip Completed</span>
          </button>
        )}

        {trip.status === 'COMPLETED' && (
          <div className="w-full text-center text-xs text-slate-400 py-2.5 px-3 bg-slate-950/60 rounded-xl border border-slate-800">
            Trip marked as completed. All manifest records finalized.
          </div>
        )}
      </div>
    </div>
  );
};
