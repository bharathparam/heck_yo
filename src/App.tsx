import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { TripCard } from './components/TripCard';
import { ManifestView } from './components/ManifestView';
import { QRScannerModal } from './components/QRScannerModal';
import { ScanFeedbackModal } from './components/ScanFeedbackModal';
import type { FeedbackData } from './components/ScanFeedbackModal';
import { OfflineQueueBanner } from './components/OfflineQueueBanner';
import { LoginModal } from './components/LoginModal';
import { RejectedScansModal } from './components/RejectedScansModal';
import { DepartWarningModal } from './components/DepartWarningModal';
import { ReauthModal } from './components/ReauthModal';
import { QueueDetailsModal } from './components/QueueDetailsModal';
import {
  Gauge,
  QrCode,
  Users,
  AlertTriangle,
  AlertOctagon,
} from 'lucide-react';

import {
  apiGetAssignedTrips,
  apiGetManifest,
  apiOpenBoarding,
  apiBoardTicket,
  apiDepartTrip,
  apiCompleteTrip,
  getStoredUser,
  getStoredToken,
  clearStoredAuth,
  onTokenExpired,
  ApiError,
} from './services/api';

import {
  getScansForTrip,
  getUnacknowledgedRejectedScans,
  acknowledgeRejectedScans,
  saveScan,
  getCachedTrips,
  getDeviceId,
} from './services/db';

import { validateTicketOffline } from './services/offlineValidation';
import { syncEngine } from './services/syncEngine';
import { sound, triggerHaptic } from './services/feedback';

import type {
  ConductorTripSummary,
  PassengerManifestItem,
  ScanRecord,
  ConductorUser,
  SyncEngineStatus,
} from './types';

type MobileTab = 'trips' | 'overview' | 'manifest';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<ConductorUser | null>(getStoredUser());
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!getStoredToken());

  const [trips, setTrips] = useState<ConductorTripSummary[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<ConductorTripSummary | null>(null);
  const [manifest, setManifest] = useState<PassengerManifestItem[]>([]);
  const [scans, setScans] = useState<ScanRecord[]>([]);

  const [activeTab, setActiveTab] = useState<MobileTab>('overview');

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Sync Engine Status
  const [syncStatus, setSyncStatus] = useState<SyncEngineStatus>({
    isSyncing: false,
    pendingCount: 0,
    provisionalCount: 0,
    serverValidatedCount: 0,
    rejectedCount: 0,
    lastSyncAt: null,
  });

  // Modals & Sheets
  const [scannerOpen, setScannerOpen] = useState<boolean>(false);
  const [isProcessingScan, setIsProcessingScan] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);

  const [showQueueDetails, setShowQueueDetails] = useState<boolean>(false);
  const [showRejectedModal, setShowRejectedModal] = useState<boolean>(false);
  const [showDepartWarning, setShowDepartWarning] = useState<boolean>(false);
  const [showReauthModal, setShowReauthModal] = useState<boolean>(false);

  // PWA Install Prompt State
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [serverErrorBanner, setServerErrorBanner] = useState<string | null>(null);

  // PWA beforeinstallprompt event handler
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    try {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallPrompt(null);
      }
    } catch (err) {
      console.warn('PWA install prompt failed', err);
    }
  };

  // Sync engine lifecycle & token expiry handler
  useEffect(() => {
    syncEngine.start();
    const unsubscribeSync = syncEngine.subscribe((status) => {
      setSyncStatus(status);
    });

    // Intercept token expiry mid-trip
    const unsubscribeToken = onTokenExpired(() => {
      setShowReauthModal(true);
    });

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
      syncEngine.stop();
      unsubscribeSync();
      unsubscribeToken();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update syncEngine active trip when selected trip changes
  useEffect(() => {
    syncEngine.setActiveTripId(selectedTrip?.id || null);
  }, [selectedTrip?.id]);

  // Load trips from API or IndexedDB offline fallback
  const loadTrips = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      setIsLoading(true);
      setServerErrorBanner(null);
      const data = await apiGetAssignedTrips();
      setTrips(data);
      if (data.length > 0) {
        setSelectedTrip((prev) => {
          if (prev) {
            return data.find((t) => t.id === prev.id) || data[0];
          }
          // Prioritize active trips: BOARDING > SCHEDULED > DEPARTED > others
          return (
            data.find((t) => t.status === 'BOARDING') ||
            data.find((t) => t.status === 'SCHEDULED') ||
            data.find((t) => t.status === 'DEPARTED') ||
            data[0]
          );
        });
      }
    } catch (err: unknown) {
      console.warn('Failed to load trips from server, trying offline cache:', err);
      const cached = await getCachedTrips();
      if (cached && cached.length > 0) {
        setTrips(cached);
        setSelectedTrip((prev) => prev || cached[0]);
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to load assigned trips';
        setServerErrorBanner(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  // Load Manifest & Scans when selected trip changes
  const loadTripData = useCallback(async () => {
    if (!selectedTrip?.id) return;
    try {
      setIsLoading(true);
      setServerErrorBanner(null);

      // Load scans from IndexedDB
      const tripScans = await getScansForTrip(selectedTrip.id);
      setScans(tripScans);

      // Check unacknowledged rejections
      const rejected = await getUnacknowledgedRejectedScans(selectedTrip.id);
      if (rejected.length > 0) {
        setShowRejectedModal(true);
      }

      // Load Manifest (fetches from API if online, falls back to IndexedDB if offline)
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
    } catch (err: unknown) {
      console.warn('Failed to load manifest online, checking offline cached manifest', err);
      // Fallback is handled within apiGetManifest, but if completely missing:
      const msg = err instanceof Error ? err.message : 'Failed to load trip manifest';
      setServerErrorBanner(msg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTrip?.id]);

  useEffect(() => {
    loadTripData();
  }, [loadTripData]);

  // Refresh scans from IndexedDB helper
  const refreshLocalScans = async () => {
    if (selectedTrip?.id) {
      const updatedScans = await getScansForTrip(selectedTrip.id);
      setScans(updatedScans);
    }
  };

  // Logout
  const handleLogout = () => {
    clearStoredAuth();
    setCurrentUser(null);
    setIsLoggedIn(false);
    setTrips([]);
    setSelectedTrip(null);
    setManifest([]);
    setScans([]);
  };

  // Re-Authentication mid-trip success
  const handleReauthSuccess = async (user: ConductorUser) => {
    setCurrentUser(user);
    setShowReauthModal(false);
    sound.playSuccess();
    // Resume sync immediately!
    if (selectedTrip?.id) {
      await syncEngine.syncNow(selectedTrip.id);
      await loadTripData();
    }
  };

  // Open Boarding Window (Enforces backend state)
  const handleOpenBoarding = async () => {
    if (!selectedTrip || isActionLoading) return;
    try {
      setIsActionLoading(true);
      setServerErrorBanner(null);
      await apiOpenBoarding(selectedTrip.id);
      setSelectedTrip((prev) => (prev ? { ...prev, status: 'BOARDING' } : null));
      await loadTripData();
      sound.playSuccess();
    } catch (err: unknown) {
      sound.playError();
      const msg = err instanceof Error ? err.message : 'Failed to open boarding';
      setServerErrorBanner(msg);
      setFeedback({
        type: 'rejected',
        title: 'Action Denied',
        message: msg,
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Trigger Depart (warns if provisional scans exist)
  const handleDepartClick = () => {
    if (!selectedTrip) return;
    const provisional = scans.filter((s) => s.state === 'LOCAL_ACCEPTED');
    if (provisional.length > 0) {
      setShowDepartWarning(true);
    } else {
      executeDepart();
    }
  };

  const executeDepart = async () => {
    if (!selectedTrip || isActionLoading) return;
    try {
      setIsActionLoading(true);
      setShowDepartWarning(false);
      setServerErrorBanner(null);
      await apiDepartTrip(selectedTrip.id);
      setSelectedTrip((prev) => (prev ? { ...prev, status: 'DEPARTED' } : null));
      sound.playSuccess();
    } catch (err: unknown) {
      sound.playError();
      const msg = err instanceof Error ? err.message : 'Departure rejected by server';
      setServerErrorBanner(msg);
      setFeedback({
        type: 'rejected',
        title: 'Departure Failed',
        message: msg,
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Sync and then Depart
  const handleSyncAndDepart = async () => {
    if (!selectedTrip) return;
    try {
      setIsActionLoading(true);
      await syncEngine.syncNow(selectedTrip.id);
      await loadTripData();
      await executeDepart();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sync before depart failed';
      setServerErrorBanner(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Complete Trip
  const handleComplete = async () => {
    if (!selectedTrip || isActionLoading) return;
    try {
      setIsActionLoading(true);
      setServerErrorBanner(null);
      await apiCompleteTrip(selectedTrip.id);
      setSelectedTrip((prev) => (prev ? { ...prev, status: 'COMPLETED' } : null));
      sound.playSuccess();
    } catch (err: unknown) {
      sound.playError();
      const msg = err instanceof Error ? err.message : 'Failed to complete trip';
      setServerErrorBanner(msg);
      setFeedback({
        type: 'rejected',
        title: 'Trip Action Error',
        message: msg,
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Core Ticket Verification & Boarding Engine
  const handleScanSuccess = async (qrInput: string) => {
    if (!selectedTrip || isProcessingScan) return;
    setIsProcessingScan(true);
    setServerErrorBanner(null);

    const now = new Date().toISOString();
    const deviceId = await getDeviceId();

    try {
      if (isOnline) {
        // Attempt Direct Online Boarding
        try {
          const res = await apiBoardTicket(selectedTrip.id, qrInput, deviceId);

          sound.playSuccess();
          triggerHaptic(true);

          // Save to IndexedDB as SERVER_VALIDATED
          const clientScanId = crypto.randomUUID();
          const validatedRecord: ScanRecord = {
            client_scan_id: clientScanId,
            trip_id: selectedTrip.id,
            ticket_id: res.ticket_id,
            ticket_reference: res.ticket_reference,
            passenger_name: res.passenger_name,
            scanned_at: now,
            device_id: deviceId,
            state: 'SERVER_VALIDATED',
            reject_reason: null,
          };
          await saveScan(validatedRecord);

          // Update local manifest status
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

          await refreshLocalScans();

          setFeedback({
            type: 'server_validated',
            title: 'Boarding Confirmed!',
            message: 'Passenger ticket verified & boarded by central server.',
            state: 'SERVER_VALIDATED',
            passengerName: res.passenger_name,
            ticketReference: res.ticket_reference,
            boardedCount: res.boarded_count,
            totalPassengers: res.total_passengers,
          });
          return;
        } catch (onlineErr: unknown) {
          // If online request failed due to network outage mid-scan, seamlessly fallback to offline validation!
          if (onlineErr instanceof ApiError && onlineErr.statusCode === 0) {
            console.log('Network dropped during online board. Falling back to offline validation.');
          } else {
            // Real validation error from server (e.g. invalid ticket, duplicate, wrong trip)
            throw onlineErr;
          }
        }
      }

      // Offline Validation Engine (validates strictly against cached manifest)
      const offlineResult = await validateTicketOffline(selectedTrip.id, qrInput);
      await refreshLocalScans();

      if (offlineResult.valid) {
        sound.playSuccess();
        triggerHaptic(true);

        setFeedback({
          type: 'local_accepted',
          title: 'Provisional Scan Saved',
          message:
            'Ticket matched offline manifest cache. Stored securely on device and marked PROVISIONAL until synced.',
          state: 'LOCAL_ACCEPTED',
          passengerName: offlineResult.passengerName,
          ticketReference: offlineResult.ticketReference,
          seatCount: offlineResult.seatCount,
        });
      } else {
        sound.playError();
        triggerHaptic(false);

        setFeedback({
          type: 'rejected',
          title: 'Scan Rejected',
          message: offlineResult.message,
          state: 'REJECTED',
          passengerName: offlineResult.passengerName,
          ticketReference: offlineResult.ticketReference,
          rejectReason: offlineResult.rejectReason,
        });

        // Trigger rejected scans modal
        setShowRejectedModal(true);
      }
    } catch (err: unknown) {
      sound.playError();
      triggerHaptic(false);

      const msg = err instanceof Error ? err.message : 'Boarding verification failed';
      setFeedback({
        type: 'rejected',
        title: 'Validation Failed',
        message: msg,
        state: 'REJECTED',
        rejectReason: msg,
      });
    } finally {
      setIsProcessingScan(false);
    }
  };

  // Manual Check In from Manifest row
  const handleManualBoard = async (ticketId: string, ticketRef: string, _passengerName: string) => {
    handleScanSuccess(ticketRef || ticketId);
  };

  // Manual Sync Now Trigger
  const handleManualSync = async () => {
    if (!selectedTrip?.id || syncStatus.isSyncing) return;
    try {
      const result = await syncEngine.syncNow(selectedTrip.id);
      await loadTripData();
      if (result.tokenExpired) {
        setShowReauthModal(true);
      } else if (result.failedCount > 0 && result.errors.length > 0) {
        setShowRejectedModal(true);
      } else if (result.syncedCount > 0) {
        sound.playSuccess();
        setFeedback({
          type: 'server_validated',
          title: 'Sync Complete',
          message: `Successfully synchronized ${result.syncedCount} provisional scans with central server!`,
        });
      }
    } catch (err: unknown) {
      sound.playError();
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setServerErrorBanner(msg);
    }
  };

  // Acknowledge All Rejected Scans
  const handleAcknowledgeAllRejected = async () => {
    if (!selectedTrip?.id) return;
    const unacked = await getUnacknowledgedRejectedScans(selectedTrip.id);
    await acknowledgeRejectedScans(unacked.map((s) => s.client_scan_id));
    setShowRejectedModal(false);
    await refreshLocalScans();
  };

  // Derived counts for current trip
  const provisionalScans = scans.filter((s) => s.state === 'LOCAL_ACCEPTED');
  const serverValidatedScans = scans.filter((s) => s.state === 'SERVER_VALIDATED');
  const rejectedScans = scans.filter((s) => s.state === 'REJECTED' && !s.acknowledged);

  // Active trip's official server boarded count
  const serverBoardedCount = selectedTrip?.boarded_count || serverValidatedScans.length;

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

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-sky-500/30">
      {/* Top Header */}
      <Header
        user={currentUser}
        isOnline={isOnline}
        provisionalCount={provisionalScans.length}
        onLogout={handleLogout}
        onSyncClick={handleManualSync}
        isSyncing={syncStatus.isSyncing}
        installPrompt={installPrompt}
        onInstallApp={handleInstallApp}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-4 pb-24 md:pb-8">
        {/* Backend Error Banner */}
        {serverErrorBanner && (
          <div className="bg-rose-950/80 border border-rose-800 rounded-2xl p-3.5 flex items-start justify-between gap-3 shadow-lg animate-fade-in">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h5 className="text-xs font-bold text-rose-200">System Notification</h5>
                <p className="text-xs text-rose-300 leading-relaxed">{serverErrorBanner}</p>
              </div>
            </div>
            <button
              onClick={() => setServerErrorBanner(null)}
              className="text-xs font-bold text-rose-400 hover:text-white px-2 py-1 rounded bg-rose-900/50"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Unacknowledged Rejections Callout */}
        {rejectedScans.length > 0 && (
          <div
            onClick={() => setShowRejectedModal(true)}
            className="cursor-pointer bg-rose-950/40 hover:bg-rose-950/60 border border-rose-600/50 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-lg transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertOctagon className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-rose-300">
                  {rejectedScans.length} Rejected Scan{rejectedScans.length > 1 ? 's' : ''} Require Attention!
                </span>
                <p className="text-slate-400 text-[11px]">Tap to review and acknowledge reasons.</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-xl text-xs font-bold bg-rose-600 text-white shrink-0">
              Review
            </span>
          </div>
        )}

        {/* Offline Queue & Sync Banner */}
        <OfflineQueueBanner
          provisionalScans={provisionalScans}
          allScans={scans}
          onSync={handleManualSync}
          onOpenDetails={() => setShowQueueDetails(true)}
          isSyncing={syncStatus.isSyncing}
          isOnline={isOnline}
          backoffDelayMs={syncStatus.backoffDelayMs}
          retryAttempt={syncStatus.retryAttempt}
        />

        {/* Mobile View Tabs Selector */}
        <div className="md:hidden flex p-1 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Duty Card</span>
          </button>
          <button
            onClick={() => setActiveTab('manifest')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'manifest'
                ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Manifest ({manifest.length})</span>
          </button>
        </div>

        {/* Assigned Trips Selector when multiple trips exist */}
        {trips.length > 1 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-400 font-medium">Assigned Trips ({trips.length}):</span>
            <select
              value={selectedTrip?.id || ''}
              onChange={(e) => {
                const found = trips.find((t) => t.id === e.target.value);
                if (found) setSelectedTrip(found);
              }}
              className="bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-sky-500 font-medium"
            >
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.route_name} ({t.status})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Trip Card Section */}
          <div
            className={`md:col-span-5 space-y-4 ${
              activeTab !== 'overview' ? 'hidden md:block' : 'block'
            }`}
          >
            {selectedTrip ? (
              <TripCard
                trip={selectedTrip}
                serverValidatedCount={serverBoardedCount}
                provisionalCount={provisionalScans.length}
                onOpenBoarding={handleOpenBoarding}
                onDepart={handleDepartClick}
                onComplete={handleComplete}
                onOpenScanner={() => setScannerOpen(true)}
                isActionLoading={isActionLoading}
              />
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
                No active duty assigned.
              </div>
            )}
          </div>

          {/* Passenger Manifest Section */}
          <div
            className={`md:col-span-7 space-y-4 ${
              activeTab !== 'manifest' ? 'hidden md:block' : 'block'
            }`}
          >
            <ManifestView
              manifest={manifest}
              scans={scans}
              onManualBoard={handleManualBoard}
              onRefresh={loadTripData}
              isLoading={isLoading}
            />
          </div>
        </div>
      </main>

      {/* Persistent Floating Scan Button for Mobile */}
      {selectedTrip && (selectedTrip.status === 'BOARDING' || selectedTrip.status === 'SCHEDULED') && (
        <div className="fixed bottom-4 left-0 right-0 z-40 px-4 md:hidden flex justify-center pb-safe pointer-events-none">
          <button
            onClick={() => setScannerOpen(true)}
            className="pointer-events-auto tap-target bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold py-3.5 px-6 rounded-2xl flex items-center gap-2.5 shadow-2xl shadow-sky-950 active-press border border-sky-400/30"
          >
            <QrCode className="w-5 h-5" />
            <span>Scan Boarding Pass</span>
            {provisionalScans.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            )}
          </button>
        </div>
      )}

      {/* QR Scanner & Manual Entry Modal */}
      <QRScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
        isProcessing={isProcessingScan}
        isOnline={isOnline}
      />

      {/* Scan Feedback Result Modal */}
      <ScanFeedbackModal data={feedback} onDismiss={() => setFeedback(null)} />

      {/* IndexedDB Queue Details Log Modal */}
      <QueueDetailsModal
        isOpen={showQueueDetails}
        onClose={() => setShowQueueDetails(false)}
        scans={scans}
        onSyncNow={handleManualSync}
        isSyncing={syncStatus.isSyncing}
        isOnline={isOnline}
      />

      {/* Rejected Scans Acknowledgment Modal */}
      <RejectedScansModal
        isOpen={showRejectedModal}
        rejectedScans={rejectedScans}
        onAcknowledgeAll={handleAcknowledgeAllRejected}
        onDismiss={() => setShowRejectedModal(false)}
      />

      {/* Depart Warning Modal for Unsynced Scans */}
      <DepartWarningModal
        isOpen={showDepartWarning}
        provisionalCount={provisionalScans.length}
        onSyncAndDepart={handleSyncAndDepart}
        onDepartAnyway={executeDepart}
        onCancel={() => setShowDepartWarning(false)}
        isSyncing={syncStatus.isSyncing}
      />

      {/* Mid-Trip Re-Authentication Modal */}
      <ReauthModal
        isOpen={showReauthModal}
        queuedCount={provisionalScans.length}
        onSuccess={handleReauthSuccess}
      />
    </div>
  );
};

export default App;
