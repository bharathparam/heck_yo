import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

export const BottomNav: React.FC = () => {
  const { t } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    {
      id: 'book',
      path: '/',
      label: t.nav.book,
      icon: 'directions_transit',
    },
    {
      id: 'schedules',
      path: '/schedules',
      label: t.nav.schedules,
      icon: 'schedule',
    },
    {
      id: 'tickets',
      path: '/tickets',
      label: t.nav.tickets,
      icon: 'confirmation_number',
    },
    {
      id: 'account',
      path: '/account',
      label: t.nav.account,
      icon: 'manage_accounts',
    },
  ];

  return (
    <nav className="fixed bottom-0 w-full z-40 pb-safe bg-[#F3F6FA]/95 backdrop-blur-md border-t border-[#D9E1EA] shadow-[0_-2px_12px_rgba(11,31,51,0.04)]">
      <div className="h-16 max-w-md mx-auto px-4 flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive =
            tab.path === '/'
              ? location.pathname === '/' || location.pathname.startsWith('/book')
              : location.pathname.startsWith(tab.path);

          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] transition-colors ${
                isActive ? 'text-[#0B1F33] font-bold' : 'text-[#74777d] hover:text-[#0B1F33]'
              }`}
              type="button"
            >
              <div className="relative">
                <span className={`material-symbols-outlined text-[24px] ${isActive ? 'font-bold' : ''}`}>
                  {tab.icon}
                </span>
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#F5A524]" />
                )}
              </div>
              <span className={`text-[11px] mt-0.5 tracking-tight ${isActive ? 'font-bold text-[#0B1F33]' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
