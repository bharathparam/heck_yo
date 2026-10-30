import React, { useState, useEffect } from 'react';
import { Bus, WifiOff, LogOut, Clock } from 'lucide-react';
import type { ConductorUser } from '../types';

interface HeaderProps {
  user: ConductorUser | null;
  isOnline: boolean;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, isOnline, onLogout }) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-30 pt-safe transition-all shadow-md">
      <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Brand & Conductor Name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-950/60 shrink-0">
            <Bus className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
                RailBus
              </h1>
              <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-sky-950 text-sky-400 border border-sky-800/80">
                PRO
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono mt-0.5">
              <Clock className="w-3 h-3 text-slate-500 shrink-0" />
              <span>{timeStr}</span>
              {user && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="truncate text-slate-300 font-sans font-medium text-[11px] sm:text-xs">
                    {user.full_name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status Badges & Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Online/Offline Status Indicator */}
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
              isOnline
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80'
                : 'bg-amber-950/80 text-amber-400 border-amber-800/80 animate-pulse'
            }`}
          >
            {isOnline ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            <span className="hidden xs:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Logout Button */}
          {user && (
            <button
              onClick={onLogout}
              title="Log out"
              aria-label="Log out"
              className="tap-target w-9 h-9 p-0 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-all border border-slate-800 hover:border-rose-900/50 flex items-center justify-center active-press"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
