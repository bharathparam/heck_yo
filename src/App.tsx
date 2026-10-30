import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { TripCard } from './components/TripCard';
import { ManifestView } from './components/ManifestView';
import { QRScannerModal } from './components/QRScannerModal';
import { ScanFeedbackModal } from './components/ScanFeedbackModal';
import type { FeedbackData } from './components/ScanFeedbackModal';
import { OfflineQueueBanner } from './components/OfflineQueueBanner';
import { LoginModal } from './components/LoginModal';
import {
  Bus,
  Gauge,
  QrCode,
  Users,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';

import {
  apiGetAssignedTrips,
  apiGetManifest,
  apiOpenBoarding,
  apiBoardTicket,
  apiSyncOfflineBatch,
  apiDepartTrip,
  apiCompleteTrip,
  getStoredUser,
  getStoredToken,
  clearStoredAuth,
} from './services/api';

import {
  getOfflineQueue,
  addToOfflineQueue,
  clearOfflineQueue,
} from './services/offlineStorage';

import { sound, triggerHaptic } from './services/feedback';

import type {
  ConductorTripSummary,
  PassengerManifestItem,
  OfflineBoardingItem,
  ConductorUser,
} from './types';

type MobileTab = 'trips' | 'overview' | 'manifest';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<ConductorUser | null>(getStoredUser());
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!getStoredToken());

  const [trips, setTrips] = useState<ConductorTripSummary[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<ConductorTripSummary | null>(null);
  const [manifest, setManifest] = useState<PassengerManifestItem[]>([]);

  const [activeTab, setActiveTab] = useState<MobileTab>('overview');

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [offlineQueue, setOfflineQueue] = useState<OfflineBoardingItem[]>([]);

  const [scannerOpen, setScannerOpen] = useState<boolean>(false);
  const [isProcessingScan, setIsProcessingScan] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Online / Offline network listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      sound.playSuccess();
    };
    const handleOffline = () => {
      setIsOnline(false);
      sound.playError();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load Trips
  const loadTrips = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      setIsLoading(true);
      const data = await apiGetAssignedTrips();
      setTrips(data);
      if (data.length > 0) {
        // Prioritize active trips: BOARDING > SCHEDULED > DEPARTED > others
        const activeTrip =
          data.find((t) => t.status === 'BOARDING') ||
          data.find((t) => t.status === 'SCHEDULED') ||
          data.find((t) => t.status === 'DEPARTED') ||
          data[0];
        setSelectedTrip((prev) => (prev ? data.find((t) => t.id === prev.id) || activeTrip : activeTrip));
      }
    } catch (err) {
      console.error('Failed to load trips:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  // Load Manifest when selected trip changes
  const loadManifest = useCallback(async () => {
    if (!selectedTrip) return;
    try {
      setIsLoading(true);
      const data = await apiGetManifest(selectedTrip.id);
      setManifest(data.manifest);
      setSelectedTrip((prev) =>
        prev
          ? {
              ...prev,
              boarded_count: data.boarded_count,
              status: data.status,
            }
          : null
      );
      setOfflineQueue(getOfflineQueue(selectedTrip.id));
    } catch (err) {
      console.error('Failed to load manifest:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTrip?.id]);

  useEffect(() => {
    if (selectedTrip?.id) {
      loadManifest();
    }
  }, [selectedTrip?.id, loadManifest]);

  // Logout
  const handleLogout = () => {
    clearStoredAuth();
    setCurrentUser(null);
    setIsLoggedIn(false);
    setTrips([]);
    setSelectedTrip(null);
    setManifest([]);
  };

  // Open Boarding Window
  const handleOpenBoarding = async () => {
    if (!selectedTrip) return;
    try {
      await apiOpenBoarding(selectedTrip.id);
      setSelectedTrip((prev) => (prev ? { ...prev, status: 'BOARDING' } : null));
      loadManifest();
      sound.playSuccess();
    } catch (err: unknown) {
      sound.playError();
      const msg = err instanceof Error ? err.message : 'Failed to open boarding';
      setFeedback({
        type: 'error',
        title: 'Boarding Error',
        message: msg,
      });
    }
  };

  // Depart Trip
  const handleDepart = async () => {
    if (!selectedTrip) return;
    try {
      await apiDepartTrip(selectedTrip.id);
      setSelectedTrip((prev) => (prev ? { ...prev, status: 'DEPARTED' } : null));
      sound.playSuccess();
    } catch (err: unknown) {
      sound.playError();
      const msg = err instanceof Error ? err.message : 'Failed to depart';
      setFeedback({
        type: 'error',
        title: 'Departure Error',
        message: msg,
      });
    }
  };

  // Complete Trip
  const handleComplete = async () => {
    if (!selectedTrip) return;
    try {
      await apiCompleteTrip(selectedTrip.id);
      setSelectedTrip((prev) => (prev ? { ...prev, status: 'COMPLETED' } : null));
      sound.playSuccess();
    } catch (err: unknown) {
      sound.playError();
      const msg = err instanceof Error ? err.message : 'Failed to complete trip';
      setFeedback({
        type: 'error',
        title: 'Trip Error',
        message: msg,
      });
    }
  };

  // Handle QR Scan & Boarding
  const handleScanSuccess = async (qrCode: string) => {
    if (!selectedTrip || isProcessingScan) return;
    setIsProcessingScan(true);

    try {
      if (isOnline) {
        const res = await apiBoardTicket(selectedTrip.id, qrCode, 'conductor-app-web');

        sound.playSuccess();
        triggerHaptic(true);

        setManifest((prev) =>
          prev.map((item) =>
            item.ticket_id === res.ticket_id ? { ...item, status: 'BOARDED' } : item
          )
        );

        setSelectedTrip((prev) =>
          prev
            ? {
                ...prev,
                boarded_count: res.boarded_count,
                status: prev.status === 'SCHEDULED' ? 'BOARDING' : prev.status,
              }
            : null
        );

        setFeedback({
          type: 'success',
          title: 'Boarding Confirmed!',
          message: 'Passenger ticket verified & boarded.',
          passengerName: res.passenger_name,
          ticketReference: res.ticket_reference,
          boardedCount: res.boarded_count,
          totalPassengers: res.total_passengers,
        });
      } else {
        const item: OfflineBoardingItem = {
          ticket_id: qrCode,
          boarded_at: new Date().toISOString(),
          device_id: 'offline-conductor',
        };

        addToOfflineQueue(selectedTrip.id, item);
        setOfflineQueue(getOfflineQueue(selectedTrip.id));

        sound.playSuccess();
        triggerHaptic(true);

        setFeedback({
          type: 'offline_saved',
          title: 'Offline Scan Saved',
          message: 'Scan stored securely on device. Will auto-sync when network returns.',
        });
      }
    } catch (err: unknown) {
      sound.playError();
      triggerHaptic(false);

      const msg = err instanceof Error ? err.message : 'Boarding verification failed';
      setFeedback({
        type: 'error',
        title: 'Validation Failed',
        message: msg,
      });
    } finally {
      setIsProcessingScan(false);
    }
  };

  // Manual Check In from Manifest
  const handleManualBoard = async (ticketId: string, ticketRef: string, passengerName: string) => {
    if (!selectedTrip) return;
    try {
      const res = await apiBoardTicket(selectedTrip.id, ticketRef, 'manual-checkin');

      sound.playSuccess();
      triggerHaptic(true);

      setManifest((prev) =>
        prev.map((item) =>
          item.ticket_id === ticketId ? { ...item, status: 'BOARDED' } : item
        )
      );

      setSelectedTrip((prev) =>
        prev
          ? {
              ...prev,
              boarded_count: res.boarded_count,
            }
          : null
      );

      setFeedback({
        type: 'success',
        title: 'Manual Check-In Confirmed',
        message: `Successfully boarded ${passengerName}`,
        passengerName,
        ticketReference: ticketRef,
      });
    } catch (err: unknown) {
      sound.playError();
      triggerHaptic(false);

      const msg = err instanceof Error ? err.message : 'Manual check-in failed';
      setFeedback({
        type: 'error',
        title: 'Check-In Error',
        message: msg,
      });
    }
  };

  // Sync Offline Queue
  const handleSyncOffline = async () => {
    if (!selectedTrip || offlineQueue.length === 0 || isSyncing) return;
    setIsSyncing(true);

    try {
      const res = await apiSyncOfflineBatch(selectedTrip.id, offlineQueue);
      clearOfflineQueue(selectedTrip.id);
      setOfflineQueue([]);

      sound.playSuccess();
      loadManifest();

      setFeedback({
        type: 'success',
        title: 'Batch Sync Complete',
        message: `Synchronized ${res.synced_count} offline scans to central database.`,
        boardedCount: res.boarded_count,
        totalPassengers: res.total_passengers,
      });
    } catch (err: unknown) {
      sound.playError();
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setFeedback({
        type: 'error',
        title: 'Sync Failed',
        message: msg,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <LoginModal
        onSuccess={(user) => {
          setCurrentUser(user);
          setIsLoggedIn(true);
        }}
      />
    );
  }

  const awaitingCount = manifest.filter((m) => m.status !== 'BOARDED').length;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-sky-500/30">
      {/* Top Header */}
      <Header user={currentUser} isOnline={isOnline} onLogout={handleLogout} />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-3 sm:px-4 pt-3 pb-24 sm:pb-8 space-y-3.5">
        {/* Offline Queue Notification Banner */}
        <OfflineQueueBanner
          queue={offlineQueue}
          onSync={handleSyncOffline}
          isSyncing={isSyncing}
          isOnline={isOnline}
        />

        {/* Assigned Trips Switcher (Dropdown / Chips) */}
        {trips.length > 1 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 shrink-0">Switch Trip:</span>
            <div className="relative flex-1 min-w-0">
              <select
                value={selectedTrip?.id || ''}
                onChange={(e) => {
                  const found = trips.find((t) => t.id === e.target.value);
                  if (found) setSelectedTrip(found);
                }}
                className="w-full bg-slate-950 text-sky-400 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs font-bold appearance-none focus:outline-none focus:border-sky-500 truncate pr-8"
              >
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.route_name} ({t.status})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Content based on view / screen size */}
        {/* Mobile View: Controlled by Bottom Tab Bar; Desktop View: Clean Stacking */}
        <div className="space-y-4">
          {/* Active Trip Card */}
          <div className={`${activeTab === 'manifest' ? 'hidden md:block' : 'block'}`}>
            {selectedTrip ? (
              <TripCard
                trip={selectedTrip}
                onOpenBoarding={handleOpenBoarding}
                onDepart={handleDepart}
                onComplete={handleComplete}
                onOpenScanner={() => setScannerOpen(true)}
              />
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-2">
                <Bus className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-medium">No trips currently assigned to your conductor profile.</p>
                <button
                  onClick={loadTrips}
                  className="tap-target px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 active-press"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Check for New Assignments</span>
                </button>
              </div>
            )}
          </div>

          {/* Passenger Manifest */}
          {selectedTrip && (
            <div className={`${activeTab === 'overview' ? 'hidden md:block' : 'block'}`}>
              <ManifestView
                manifest={manifest}
                onManualBoard={handleManualBoard}
                onRefresh={loadManifest}
                isLoading={isLoading}
              />
            </div>
          )}

          {/* Trips Tab (When in 'trips' mode on mobile) */}
          {activeTab === 'trips' && (
            <div className="md:hidden space-y-3">
              <h3 className="text-sm font-bold text-white px-1">My Duty Schedule</h3>
              <div className="space-y-2.5">
                {trips.map((t) => {
                  const isSelected = selectedTrip?.id === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setSelectedTrip(t);
                        setActiveTab('overview');
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer active-press ${
                        isSelected
                          ? 'bg-sky-950/40 border-sky-600/80 shadow-md shadow-sky-950/40'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate">{t.route_name}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            t.status === 'BOARDING'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : t.status === 'SCHEDULED'
                              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                        <span>{t.origin} ➔ {t.destination}</span>
                        <span className="font-semibold text-slate-300">
                          {t.boarded_count} / {t.total_confirmed_passengers} Boarded
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-xl pb-safe md:hidden">
        <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto">
          {/* Trips Tab */}
          <button
            onClick={() => setActiveTab('trips')}
            className={`flex flex-col items-center justify-center min-w-[56px] py-1 transition-colors ${
              activeTab === 'trips' ? 'text-sky-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bus className="w-5 h-5" />
            <span className="text-[10px] mt-1">Trips</span>
          </button>

          {/* Overview Tab */}
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex flex-col items-center justify-center min-w-[56px] py-1 transition-colors ${
              activeTab === 'overview' ? 'text-sky-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gauge className="w-5 h-5" />
            <span className="text-[10px] mt-1">Overview</span>
          </button>

          {/* Center Elevated QR Scan Button */}
          <button
            onClick={() => setScannerOpen(true)}
            className="flex flex-col items-center justify-center -mt-5"
            aria-label="Scan QR Code"
          >
            <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-sky-900/60 active-press transition-transform border-4 border-[#090d16]">
              <QrCode className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold text-sky-400 mt-1">Scan</span>
          </button>

          {/* Manifest Tab */}
          <button
            onClick={() => setActiveTab('manifest')}
            className={`flex flex-col items-center justify-center min-w-[56px] py-1 transition-colors relative ${
              activeTab === 'manifest' ? 'text-sky-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Users className="w-5 h-5" />
              {awaitingCount > 0 && (
                <span className="absolute -top-1 -right-2.5 bg-amber-500 text-slate-950 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full leading-none">
                  {awaitingCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1">Manifest</span>
          </button>
        </div>
      </nav>

      {/* Camera QR Scanner Modal */}
      <QRScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
        isProcessing={isProcessingScan}
      />

      {/* Instant Audio/Visual Scan Feedback Modal */}
      <ScanFeedbackModal
        data={feedback}
        onDismiss={() => setFeedback(null)}
      />
    </div>
  );
};

export default App;
