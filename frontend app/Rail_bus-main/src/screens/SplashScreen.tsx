import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export const SplashScreen: React.FC = () => {
  const navigate = useNavigate();
  const { t, user } = useApp();

  useEffect(() => {
    const timer = setTimeout(() => {
      const hasChosenLang = localStorage.getItem('railbus_lang');
      if (!hasChosenLang) {
        navigate('/language', { replace: true });
      } else {
        navigate(user ? '/' : '/auth/login', { replace: true });
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [navigate, user]);

  return (
    <div className="min-h-screen bg-[#0B1F33] flex flex-col items-center justify-between p-8 text-white select-none">
      <div className="w-full" />

      {/* Center Branding */}
      <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="w-20 h-20 rounded-3xl bg-[#F5A524] flex items-center justify-center text-[#0B1F33] shadow-2xl">
          <span className="material-symbols-outlined text-[44px]">directions_bus</span>
        </div>
        <div>
          <h1 className="font-extrabold text-3xl tracking-tight text-white">RailBus</h1>
          <p className="text-sm text-[#F5A524] font-semibold tracking-wider uppercase mt-1">
            Mysuru Feeder Transit
          </p>
        </div>
        <p className="text-xs text-[#A0B0C0] max-w-xs leading-relaxed pt-2">
          {t.splash.tagline}
        </p>
      </div>

      {/* Footer partner attribution & loader */}
      <div className="flex flex-col items-center space-y-3 pb-6">
        <div className="w-6 h-6 border-2 border-[#F5A524] border-t-transparent rounded-full animate-spin" />
        <span className="text-[11px] text-[#A0B0C0] tracking-wide">
          {t.common.ksrtcPartner}
        </span>
      </div>
    </div>
  );
};
