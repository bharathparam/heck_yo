import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { User, Phone, Globe, HardDrive, HelpCircle, LogOut, CheckCircle2, Shield } from 'lucide-react';
import { clearOfflineTickets } from '../services/api';

export const AccountScreen: React.FC = () => {
  const navigate = useNavigate();
  const { t, language, setLanguage, user, logoutUser, bookings, refreshData } = useApp();
  const [clearedNotice, setClearedNotice] = useState(false);

  const handleClearCache = async () => {
    try {
      await clearOfflineTickets();
      await refreshData();
      setClearedNotice(true);
      setTimeout(() => setClearedNotice(false), 2500);
    } catch (e) {
      console.warn('Error clearing IDB:', e);
    }
  };

  const handleLogout = () => {
    logoutUser();
    navigate('/auth/login');
  };

  return (
    <div className="flex flex-col w-full max-w-md mx-auto space-y-4 pb-28 pt-20 px-4">
      {/* Title */}
      <h1 className="font-bold text-2xl text-[#0B1F33] tracking-tight">
        {t.account.title}
      </h1>

      {/* User Profile Card */}
      <div className="bg-white rounded-2xl p-5 border border-[#D9E1EA] shadow-sm flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#0B1F33] text-[#F5A524] flex items-center justify-center font-bold text-xl shadow-md">
          <User className="w-7 h-7" />
        </div>
        <div className="space-y-0.5">
          <h2 className="font-bold text-lg text-[#0B1F33] leading-tight">
            {user?.full_name || 'Passenger'}
          </h2>
          <p className="text-xs text-[#74777d] font-mono flex items-center gap-1">
            <Phone className="w-3 h-3 text-[#74777d]" />
            <span>{user?.phone || user?.email || 'Contact details not provided'}</span>
          </p>
          <span className="inline-flex items-center gap-1 text-[10px] text-[#0B7A55] font-bold">
            <Shield className="w-3 h-3" />
            <span>KSRTC Passenger Verified</span>
          </span>
        </div>
      </div>

      {/* Preference 1: Language Switcher */}
      <div className="bg-white rounded-2xl p-4 border border-[#D9E1EA] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Globe className="w-4 h-4 text-[#0B1F33]" />
            <span className="text-sm font-bold text-[#0B1F33]">{t.account.languagePref}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
              language === 'en'
                ? 'bg-[#0B1F33] text-white border-[#0B1F33] shadow-sm'
                : 'bg-[#F3F6FA] text-[#0B1F33] border-[#D9E1EA]'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLanguage('kn')}
            className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all font-kannada ${
              language === 'kn'
                ? 'bg-[#0B1F33] text-white border-[#0B1F33] shadow-sm'
                : 'bg-[#F3F6FA] text-[#0B1F33] border-[#D9E1EA]'
            }`}
          >
            ಕನ್ನಡ
          </button>
        </div>
      </div>

      {/* Preference 2: Offline Vault Status */}
      <div className="bg-white rounded-2xl p-4 border border-[#D9E1EA] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-4 h-4 text-[#0B1F33]" />
            <div>
              <span className="text-sm font-bold text-[#0B1F33] block">{t.account.offlineStorage}</span>
              <span className="text-[11px] text-[#74777d]">{bookings.length} ticket(s) cached in IndexedDB</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearCache}
            className="text-xs font-bold text-[#D32F2F] hover:underline"
          >
            {t.account.clearCache}
          </button>
        </div>
        {clearedNotice && (
          <div className="p-2 bg-[#E6F4EA] rounded-lg text-xs text-[#0B7A55] font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{t.account.clearedSuccess}</span>
          </div>
        )}
      </div>

      {/* Support & Helpline */}
      <div className="bg-white rounded-2xl p-4 border border-[#D9E1EA] shadow-sm space-y-2">
        <div className="flex items-center gap-2.5">
          <HelpCircle className="w-4 h-4 text-[#0B1F33]" />
          <span className="text-sm font-bold text-[#0B1F33]">{t.account.supportTitle}</span>
        </div>
        <p className="text-xs text-[#74777d]">
          For conductor disputes, platform inquiries or delayed train adjustments:
        </p>
        <a
          href="tel:18004254422"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B1F33] bg-[#F3F6FA] px-3 py-1.5 rounded-lg border border-[#D9E1EA]"
        >
          <Phone className="w-3 h-3 text-[#0B7A55]" />
          <span>{t.account.supportPhone}</span>
        </a>
      </div>

      {/* Sign Out Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full h-12 rounded-xl bg-white border border-[#D32F2F] text-[#D32F2F] font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"
        >
          <LogOut className="w-4 h-4" />
          <span>{t.account.logoutBtn}</span>
        </button>
      </div>
    </div>
  );
};
