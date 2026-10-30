import React from 'react';
import type { TripStatus, BusStatus, ConductorStatus, IntegrationState } from '../../types';

interface BadgeProps {
  status: TripStatus | BusStatus | ConductorStatus | IntegrationState | string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, className = '' }) => {
  const norm = String(status || '').toUpperCase();

  const getStyle = () => {
    switch (norm) {
      case 'THRESHOLD_MET':
      case 'READY_TO_DISPATCH':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'SCHEDULED':
      case 'DISPATCHED':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'BOARDING':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'DEPARTED':
        return 'bg-indigo-100 text-indigo-900 border-indigo-300';
      case 'COMPLETED':
      case 'AVAILABLE':
      case 'LIVE':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'CANCELLED':
      case 'MAINTENANCE':
      case 'NOT_CONNECTED':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      case 'SYNTHETIC_DATA':
        return 'bg-amber-100 text-amber-900 border-amber-400 font-bold';
      case 'AGGREGATING':
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStyle()} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      <span>{norm.replace(/_/g, ' ')}</span>
    </span>
  );
};
