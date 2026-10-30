import React from 'react';
import { Menu, LogOut, ShieldCheck, User } from 'lucide-react';
import type { UserProfile, AuthUser } from '../../types';

interface TopbarProps {
  user: UserProfile | AuthUser;
  onOpenMobile: () => void;
  onLogout: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ user, onOpenMobile, onLogout }) => {
  return (
    <header className="h-16 px-4 md:px-6 bg-white border-b border-[#D9E1EA] flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="md:hidden p-2 rounded-lg border border-[#D9E1EA] text-[#0B1F33] hover:bg-[#F3F6FA]"
          type="button"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#74777d]">
          <span>RailBus Operations</span>
          <span>/</span>
          <span className="text-[#0B1F33] font-bold">Control Console</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF2FA] border border-[#D9E1EA] text-xs font-semibold text-[#0B1F33]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0B7A55]" />
          <span>Role: {user.role}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#0B1F33] text-[#F5A524] flex items-center justify-center font-bold text-xs">
            {user.full_name?.slice(0, 2).toUpperCase() || <User className="w-4 h-4" />}
          </div>
          <div className="hidden md:block text-left">
            <span className="block text-xs font-bold text-[#0B1F33] leading-tight">
              {user.full_name}
            </span>
            <span className="block text-[10px] text-[#74777d]">{user.email}</span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="p-2 rounded-xl text-[#74777d] hover:text-[#D32F2F] hover:bg-rose-50 transition-colors"
          title="Sign out"
          type="button"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
