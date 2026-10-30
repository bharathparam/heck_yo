import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Bell, User } from 'lucide-react';

export const TopBar: React.FC = () => {
  const { language, setLanguage, notifications } = useApp();
  const navigate = useNavigate();

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <header className="fixed top-0 w-full z-40 pt-safe bg-[#F3F6FA]/90 backdrop-blur-md border-b border-[#D9E1EA]">
      <div className="h-16 px-4 max-w-md mx-auto flex items-center justify-between">
        {/* Brand Logo & Wordmark */}
        <div 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 cursor-pointer active:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-[#0B1F33] flex items-center justify-center text-[#F5A524] shadow-sm">
            <span className="material-symbols-outlined text-[20px]">directions_bus</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[18px] text-[#0B1F33] tracking-tight leading-none">RailBus</span>
            <span className="text-[10px] text-[#74777d] font-medium tracking-wide">Mysuru Feeder</span>
          </div>
        </div>

        {/* Right actions: Language Switcher, Notifications, Profile */}
        <div className="flex items-center gap-2">
          {/* Segmented EN | ಕನ್ನಡ Toggle */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'kn' : 'en')}
            className="min-h-[40px] px-3 py-1 rounded-full bg-white border border-[#D9E1EA] text-[#0B1F33] font-semibold text-xs flex items-center justify-center shadow-sm active:scale-95 transition-transform"
            type="button"
            title="Toggle English / Kannada"
          >
            <span className={language === 'en' ? 'text-[#0B1F33] font-bold' : 'text-[#74777d]'}>EN</span>
            <span className="mx-1 text-[#D9E1EA] font-normal">|</span>
            <span className={language === 'kn' ? 'text-[#0B1F33] font-bold' : 'text-[#74777d]'}>ಕನ್ನಡ</span>
          </button>

          {/* Notifications Icon with Badge */}
          <button
            onClick={() => navigate('/notifications')}
            className="relative w-9 h-9 rounded-full bg-white border border-[#D9E1EA] flex items-center justify-center text-[#0B1F33] active:scale-95 transition-transform shadow-sm"
            type="button"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#F5A524] text-[#0B1F33] font-bold text-[10px] flex items-center justify-center border border-white">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Account Icon */}
          <button
            onClick={() => navigate('/account')}
            className="w-9 h-9 rounded-full bg-[#0B1F33] flex items-center justify-center text-white active:scale-95 transition-transform shadow-sm"
            type="button"
            title="Account"
          >
            <User className="w-4 h-4 text-[#F5A524]" />
          </button>
        </div>
      </div>
    </header>
  );
};
