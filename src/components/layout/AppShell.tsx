import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import type { UserProfile, AuthUser } from '../../types';

interface AppShellProps {
  user: UserProfile | AuthUser;
  onLogout: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ user, onLogout, children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F3F6FA] text-[#0B1F33] flex flex-col md:flex-row antialiased font-sans">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} userRole={user.role} />

      <div className="flex-1 md:ml-64 flex flex-col min-w-0">
        <Topbar user={user} onOpenMobile={() => setMobileOpen(true)} onLogout={onLogout} />
        <main className="flex-1 p-4 md:p-6 space-y-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};
