import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { TopBar } from './components/common/TopBar';
import { BottomNav } from './components/common/BottomNav';
import { OfflineBanner } from './components/common/OfflineBanner';
import { InstallBanner } from './components/common/InstallBanner';

// Screens
import { SplashScreen } from './screens/SplashScreen';
import { LanguageSelectScreen } from './screens/LanguageSelectScreen';
import { LoginScreen } from './screens/LoginScreen';
import { TripRegistrationScreen } from './screens/TripRegistrationScreen';
import { SeatSelectionScreen } from './screens/SeatSelectionScreen';
import { PaymentScreen } from './screens/PaymentScreen';
import { TicketScreen } from './screens/TicketScreen';
import { BookingHistoryScreen } from './screens/BookingHistoryScreen';
import { AlternativesScreen } from './screens/AlternativesScreen';
import { SchedulesScreen } from './screens/SchedulesScreen';
import { AccountScreen } from './screens/AccountScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';

const MainLayout: React.FC = () => {
  const location = useLocation();
  const { user, authChecking, dataError, refreshData } = useApp();

  // Hide TopBar & BottomNav on splash, onboarding, and auth screens
  const isMinimalScreen =
    location.pathname === '/splash' ||
    location.pathname === '/language' ||
    location.pathname.startsWith('/auth');

  if (authChecking && !user) return <div className="min-h-screen grid place-items-center text-sm text-[#74777d]">Checking your RailBus session…</div>;
  if (!user && !isMinimalScreen) return <Navigate to="/auth/login" replace />;

  return (
    <div className="min-h-screen bg-[#F3F6FA] text-[#0B1F33] flex flex-col font-sans select-none antialiased">
      {!isMinimalScreen && <TopBar />}
      <OfflineBanner />
      {dataError && <div role="alert" className="fixed z-30 top-16 left-1/2 -translate-x-1/2 w-[min(92%,28rem)] mt-safe rounded-xl border border-[#D32F2F]/20 bg-white px-3 py-2 shadow-lg text-xs text-[#D32F2F] flex items-center justify-between gap-3"><span>{dataError}</span><button onClick={() => void refreshData()} className="shrink-0 font-bold underline">Retry</button></div>}

      <main className="flex-1 w-full">
        <Routes>
          <Route path="/splash" element={<SplashScreen />} />
          <Route path="/language" element={<LanguageSelectScreen />} />
          <Route path="/auth/login" element={<LoginScreen />} />

          {/* Core Booking Funnel */}
          <Route path="/" element={<TripRegistrationScreen />} />
          <Route path="/book/buses" element={<Navigate to="/" replace />} />
          <Route path="/book/seats" element={<SeatSelectionScreen />} />
          <Route path="/book/pay" element={<PaymentScreen />} />

          {/* Tickets & History */}
          <Route path="/tickets" element={<BookingHistoryScreen />} />
          <Route path="/tickets/:id" element={<TicketScreen />} />

          {/* Secondary Views */}
          <Route path="/alternatives" element={<AlternativesScreen />} />
          <Route path="/schedules" element={<SchedulesScreen />} />
          <Route path="/account" element={<AccountScreen />} />
          <Route path="/notifications" element={<NotificationsScreen />} />
          <Route path="*" element={<Navigate to={user ? '/' : '/auth/login'} replace />} />
        </Routes>
      </main>

      {!isMinimalScreen && <BottomNav />}
      <InstallBanner />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <BrowserRouter basename={window.location.pathname.startsWith('/passenger-app') ? '/passenger-app' : undefined}>
        <MainLayout />
      </BrowserRouter>
    </AppProvider>
  );
};

export default App;
