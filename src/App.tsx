import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryProvider } from './context/QueryProvider';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { RoleGuard } from './features/auth/RoleGuard';
import { authService } from './features/auth/authService';
import { OverviewPage } from './features/overview/OverviewPage';
import { DispatchCentrePage } from './features/dispatch/DispatchCentrePage';
import { TripsPage } from './features/trips/TripsPage';
import { FleetPage } from './features/fleet/FleetPage';
import { ConductorsPage } from './features/conductors/ConductorsPage';
import { BookingsPage } from './features/bookings/BookingsPage';
import { LiveOperationsPage } from './features/operations/LiveOperationsPage';
import { AuditPage } from './features/audit/AuditPage';
import { SmartSyncPage } from './features/smartsync/SmartSyncPage';
import { TrainIntelligencePage } from './features/trains/TrainIntelligencePage';
import type { AuthUser, UserProfile } from './types';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | UserProfile | null>(() =>
    authService.getUser()
  );

  useEffect(() => {
    const handleAuthExpired = () => setCurrentUser(null);
    window.addEventListener('railbus-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('railbus-auth-expired', handleAuthExpired);
  }, []);

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <LoginPage onSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <QueryProvider>
      <AppShell user={currentUser} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route
            path="/dispatch"
            element={
              <RoleGuard userRole={currentUser.role} allowedRoles={['OPERATOR', 'ADMIN']}>
                <DispatchCentrePage />
              </RoleGuard>
            }
          />
          <Route path="/trips" element={<TripsPage />} />
          <Route
            path="/fleet"
            element={
              <RoleGuard userRole={currentUser.role} allowedRoles={['OPERATOR', 'ADMIN']}>
                <FleetPage />
              </RoleGuard>
            }
          />
          <Route
            path="/conductors"
            element={
              <RoleGuard userRole={currentUser.role} allowedRoles={['OPERATOR', 'ADMIN']}>
                <ConductorsPage />
              </RoleGuard>
            }
          />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/operations" element={<LiveOperationsPage />} />
          <Route
            path="/audit"
            element={
              <RoleGuard userRole={currentUser.role} allowedRoles={['OPERATOR', 'ADMIN']}>
                <AuditPage />
              </RoleGuard>
            }
          />
          <Route path="/smartsync" element={<SmartSyncPage />} />
          <Route path="/trains" element={<TrainIntelligencePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </QueryProvider>
  );
};

export default App;
