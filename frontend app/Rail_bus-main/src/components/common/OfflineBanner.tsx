import React from 'react';
import { useApp } from '../../context/AppContext';
import { WifiOff } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const { isOnline, t } = useApp();

  if (isOnline) return null;

  return (
    <div 
      role="status" 
      aria-live="polite"
      className="bg-[#0B1F33] text-[#F3F6FA] px-4 py-2 text-xs flex items-center justify-between border-b border-[#D9E1EA] fixed top-16 left-0 right-0 z-50 shadow-sm"
    >
      <div className="flex items-center gap-2 max-w-md mx-auto w-full">
        <span className="w-2 h-2 rounded-full bg-[#F5A524] animate-pulse shrink-0" />
        <WifiOff className="w-3.5 h-3.5 text-[#F5A524] shrink-0" />
        <span className="truncate">{t.common.offlineBanner}</span>
      </div>
    </div>
  );
};
