import React, { createContext, useContext, useState, useEffect } from 'react';
import { PassengerProfile, Trip, BusRoute, Booking, NotificationItem } from '../types';
import { translations } from '../i18n/translations';
import { api, getOfflineTickets, clearAuthCache } from '../services/api';

type Language = 'en' | 'kn';

interface BookingFlowState {
  boardingStop: string;
  destinationStopId: string;
  selectedTripId: string;
  seatCount: number;
}

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (typeof translations)['en'];
  user: PassengerProfile | null;
  authChecking: boolean;
  loginUser: (email: string, password: string) => Promise<void>;
  registerUser: (fullName: string, email: string, phone: string, password: string) => Promise<void>;
  logoutUser: () => void;
  isOnline: boolean;
  trips: Trip[];
  routes: BusRoute[];
  bookings: Booking[];
  activeBookingFlow: BookingFlowState;
  updateBookingFlow: (updates: Partial<BookingFlowState>) => void;
  resetBookingFlow: () => void;
  refreshData: () => Promise<void>;
  dataError: string;
  showInstallBanner: boolean;
  dismissInstallBanner: () => void;
  triggerInstall: () => void;
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('railbus_lang');
    return saved === 'kn' ? 'kn' : 'en';
  });

  const [user, setUser] = useState<PassengerProfile | null>(() => {
    try {
      const cached = localStorage.getItem('railbus_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [authChecking, setAuthChecking] = useState<boolean>(() => Boolean(sessionStorage.getItem('railbus-token')));
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dataError, setDataError] = useState('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [activeBookingFlow, setActiveBookingFlow] = useState<BookingFlowState>({
    boardingStop: 'Mysuru Junction (Railway Station)',
    destinationStopId: '',
    selectedTripId: '',
    seatCount: 1,
  });

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  useEffect(() => {
    if (!sessionStorage.getItem('railbus-token')) {
      setAuthChecking(false);
      return;
    }
    api.getMe()
      .then((profile) => {
        setUser(profile);
        localStorage.setItem('railbus_user', JSON.stringify(profile));
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem('railbus_user');
      })
      .finally(() => setAuthChecking(false));

    const expire = () => {
      setUser(null);
      localStorage.removeItem('railbus_user');
    };
    window.addEventListener('railbus-auth-expired', expire);
    return () => window.removeEventListener('railbus-auth-expired', expire);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('railbus_lang', lang);
  };

  const refreshData = async () => {
    try {
      if (!isOnline) {
        const offline = await getOfflineTickets();
        setBookings(offline);
        return;
      }
      const [fetchedTrips, fetchedRoutes, fetchedBookings] = await Promise.all([
        api.getTrips().catch(() => []),
        api.getRoutes().catch(() => []),
        user ? api.getBookings() : Promise.resolve([]),
      ]);
      setTrips(fetchedTrips);
      setRoutes(fetchedRoutes);
      setBookings(fetchedBookings);
      setDataError('');
    } catch (err) {
      console.warn('[Context] Error fetching data, reading offline vault:', err);
      setDataError(err instanceof Error ? err.message : 'Could not load current RailBus data.');
      const offline = await getOfflineTickets();
      setBookings(offline);
    }
  };

  useEffect(() => {
    void refreshData();
  }, [isOnline, user?.id]);

  // Notifications polling: every 30s while visible, stop when hidden
  useEffect(() => {
    if (!user || !isOnline) return;
    let active = true;
    let timer: number | null = null;

    const fetchNotifs = async () => {
      try {
        const items = await api.getNotifications();
        if (!active) return;
        setNotifications(items);
      } catch {
        // Suppress background polling network error
      }
    };

    const startPolling = () => {
      if (timer) clearInterval(timer);
      void fetchNotifs();
      timer = window.setInterval(() => {
        void fetchNotifs();
      }, 30000); // 30 seconds
    };

    const stopPolling = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (document.visibilityState === 'visible') {
      startPolling();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id, isOnline]);

  const updateBookingFlow = (updates: Partial<BookingFlowState>) => {
    setActiveBookingFlow((prev) => ({ ...prev, ...updates }));
  };

  const resetBookingFlow = () => {
    setActiveBookingFlow({
      boardingStop: 'Mysuru Junction (Railway Station)',
      destinationStopId: '',
      selectedTripId: '',
      seatCount: 1,
    });
  };

  const loginUser = async (email: string, password: string) => {
    const profile = await api.login(email, password);
    setUser(profile);
    localStorage.setItem('railbus_user', JSON.stringify(profile));
    await refreshData();
  };

  const registerUser = async (fullName: string, email: string, phone: string, password: string) => {
    const profile = await api.register(fullName, email, phone, password);
    setUser(profile);
    localStorage.setItem('railbus_user', JSON.stringify(profile));
    await refreshData();
  };

  const logoutUser = () => {
    clearAuthCache();
    setUser(null);
    setBookings([]);
    setNotifications([]);
  };

  const triggerInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('railbus_install_dismissed', 'true');
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
    void api.markNotificationRead(id).catch(() => {});
  };

  const t = translations[language] || translations.en;

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        t,
        user,
        authChecking,
        loginUser,
        registerUser,
        logoutUser,
        isOnline,
        trips,
        routes,
        bookings,
        activeBookingFlow,
        updateBookingFlow,
        resetBookingFlow,
        refreshData,
        dataError,
        showInstallBanner,
        dismissInstallBanner,
        triggerInstall,
        notifications,
        markNotificationRead,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
