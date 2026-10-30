import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Send,
  CalendarDays,
  Bus,
  Users,
  CreditCard,
  Activity,
  History,
  Radio,
  Train,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../services/apiClient';

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
  userRole: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onClose }) => {
  // TanStack Query to count THRESHOLD_MET trips for dispatch badge
  const { data: trips = [] } = useQuery({
    queryKey: ['trips', 'all'],
    queryFn: () => apiClient.getTrips(),
    refetchInterval: 15000,
  });

  const thresholdCount = trips.filter(
    (t) => t.status === 'THRESHOLD_MET' || t.status === 'READY_TO_DISPATCH'
  ).length;

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    {
      to: '/dispatch',
      label: 'Dispatch Centre',
      icon: Send,
      badge: thresholdCount > 0 ? thresholdCount : undefined,
    },
    { to: '/trips', label: 'Demand Trips', icon: CalendarDays },
    { to: '/fleet', label: 'Fleet Utilisation', icon: Bus },
    { to: '/conductors', label: 'Crew & Conductors', icon: Users },
    { to: '/bookings', label: 'Bookings & Payments', icon: CreditCard },
    { to: '/operations', label: 'Live Operations', icon: Activity },
    { to: '/audit', label: 'Audit History', icon: History },
    { to: '/smartsync', label: 'SmartSync Telemetry', icon: Radio },
    { to: '/trains', label: 'Train Intelligence', icon: Train },
  ];

  return (
    <aside
      className={`sidebar fixed inset-y-0 left-0 z-50 w-64 bg-[#0B1F33] text-white flex flex-col transition-transform duration-200 md:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-[#1E3A52] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#F5A524] text-[#0B1F33] flex items-center justify-center font-bold">
            <Train className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white">RailBus</span>
            <span className="block text-[10px] text-[#A0B0C0] font-medium leading-none">
              Operations Console
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="md:hidden text-[#A0B0C0] hover:text-white"
          type="button"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 py-2 text-[10px] font-bold text-[#A0B0C0] uppercase tracking-wider">
        Operations Navigation
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              end={item.to === '/'}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#F5A524] text-[#0B1F33] shadow-sm font-bold'
                    : 'text-[#C5D0DC] hover:bg-[#152B3E] hover:text-white'
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono text-[10px] font-bold animate-pulse">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div className="p-4 border-t border-[#1E3A52] space-y-2 text-xs">
        <div className="flex items-center gap-2 text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-[11px]">Consolidated FastAPI Connected</span>
        </div>
        <p className="text-[10px] text-[#A0B0C0]">
          Mysuru Junction Feeder Bus Hub · Local Production
        </p>
      </div>
    </aside>
  );
};
