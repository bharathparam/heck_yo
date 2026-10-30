import {
  getPendingScans,
  updateScan,
  getScansForTrip,
  getUnacknowledgedRejectedScans,
  saveCachedManifest,
} from './db';
import { apiSyncOfflineBatch, apiGetManifest, TokenExpiredError } from './api';
import type { ScanRecord, SyncEngineStatus, OfflineBoardingItem } from '../types';

type SyncListener = (status: SyncEngineStatus) => void;

class SyncEngine {
  private isSyncing = false;
  private retryAttempt = 0;
  private backoffTimer: ReturnType<typeof setTimeout> | null = null;
  private currentBackoffMs = 0;
  private lastSyncAt: string | null = null;
  private listeners: Set<SyncListener> = new Set();
  private isStarted = false;
  private activeTripId: string | null = null;

  public setActiveTripId(tripId: string | null): void {
    this.activeTripId = tripId;
    this.broadcastStatus();
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    // Send immediate snapshot
    this.getStatus().then((s) => listener(s));
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async broadcastStatus(): Promise<void> {
    const status = await this.getStatus();
    this.listeners.forEach((fn) => {
      try {
        fn(status);
      } catch (err) {
        console.error('Error in sync status listener', err);
      }
    });
  }

  public async getStatus(tripId?: string): Promise<SyncEngineStatus> {
    const targetTrip = tripId || this.activeTripId || undefined;
    const pending = await getPendingScans(targetTrip);
    const provisional = pending.filter((s) => s.state === 'LOCAL_ACCEPTED');
    const rejected = await getUnacknowledgedRejectedScans(targetTrip);

    let serverValidatedCount = 0;
    if (targetTrip) {
      const scans = await getScansForTrip(targetTrip);
      serverValidatedCount = scans.filter((s) => s.state === 'SERVER_VALIDATED').length;
    }

    return {
      isSyncing: this.isSyncing,
      pendingCount: pending.length,
      provisionalCount: provisional.length,
      serverValidatedCount,
      rejectedCount: rejected.length,
      lastSyncAt: this.lastSyncAt,
      backoffDelayMs: this.currentBackoffMs,
      retryAttempt: this.retryAttempt,
    };
  }

  public start(): void {
    if (this.isStarted || typeof window === 'undefined') return;
    this.isStarted = true;

    // Automatic Reconnect Listener
    window.addEventListener('online', this.handleOnlineReconnect);
  }

  public stop(): void {
    if (!this.isStarted || typeof window === 'undefined') return;
    this.isStarted = false;
    window.removeEventListener('online', this.handleOnlineReconnect);
    if (this.backoffTimer) {
      clearTimeout(this.backoffTimer);
      this.backoffTimer = null;
    }
  }

  private handleOnlineReconnect = (): void => {
    // Connection restored! Cancel any backoff delay and sync immediately
    if (this.backoffTimer) {
      clearTimeout(this.backoffTimer);
      this.backoffTimer = null;
    }
    this.retryAttempt = 0;
    this.currentBackoffMs = 0;
    this.syncAllPending();
  };

  /**
   * Syncs all pending scans across all trips or for a specific trip
   */
  public async syncAllPending(specificTripId?: string): Promise<{
    syncedCount: number;
    failedCount: number;
    errors: string[];
    tokenExpired?: boolean;
  }> {
    if (this.isSyncing) {
      return { syncedCount: 0, failedCount: 0, errors: ['Sync already in progress'] };
    }

    // Check if network is available
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { syncedCount: 0, failedCount: 0, errors: ['Device is offline'] };
    }

    const pendingScans = await getPendingScans(specificTripId);
    if (pendingScans.length === 0) {
      this.broadcastStatus();
      return { syncedCount: 0, failedCount: 0, errors: [] };
    }

    // Group scans by trip_id
    const tripGroups = new Map<string, ScanRecord[]>();
    for (const scan of pendingScans) {
      const group = tripGroups.get(scan.trip_id) || [];
      group.push(scan);
      tripGroups.set(scan.trip_id, group);
    }

    this.isSyncing = true;
    this.broadcastStatus();

    let totalSynced = 0;
    let totalFailed = 0;
    const allErrors: string[] = [];
    let tokenExpired = false;

    try {
      for (const [tripId, scans] of tripGroups.entries()) {
        // Mark scans as SYNCING in IndexedDB
        for (const scan of scans) {
          await updateScan(scan.client_scan_id, { state: 'SYNCING' });
        }
        await this.broadcastStatus();

        try {
          const batchItems: OfflineBoardingItem[] = scans.map((s) => ({
            ticket_id: s.ticket_id,
            ticket_reference: s.ticket_reference,
            passenger_name: s.passenger_name,
            boarded_at: s.scanned_at,
            device_id: s.device_id,
          }));

          const res = await apiSyncOfflineBatch(tripId, batchItems);

          // Per-item reconciliation:
          for (const scan of scans) {
            const hasError = res.errors?.find(
              (e) =>
                e.includes(scan.ticket_id) ||
                (scan.ticket_reference && e.includes(scan.ticket_reference))
            );

            if (hasError) {
              await updateScan(scan.client_scan_id, {
                state: 'REJECTED',
                reject_reason: hasError,
                acknowledged: false,
              });
            } else {
              await updateScan(scan.client_scan_id, {
                state: 'SERVER_VALIDATED',
                reject_reason: null,
              });
            }
          }

          totalSynced += res.synced_count;
          totalFailed += res.failed_count;
          if (res.errors && res.errors.length > 0) {
            allErrors.push(...res.errors);
          }

          // Refresh official manifest from server to align boarded counts
          try {
            const updatedManifest = await apiGetManifest(tripId);
            await saveCachedManifest(updatedManifest);
          } catch {
            // Ignore manifest refresh error if batch succeeded
          }
        } catch (err: unknown) {
          if (err instanceof TokenExpiredError) {
            tokenExpired = true;
            // Rollback scans to LOCAL_ACCEPTED so they aren't lost
            for (const scan of scans) {
              await updateScan(scan.client_scan_id, { state: 'LOCAL_ACCEPTED' });
            }
            allErrors.push('Session expired mid-sync. Please re-authenticate.');
            break; // Stop processing further trips until re-login
          } else {
            // Network failure or other server error: revert to LOCAL_ACCEPTED
            for (const scan of scans) {
              await updateScan(scan.client_scan_id, { state: 'LOCAL_ACCEPTED' });
            }
            const msg = err instanceof Error ? err.message : 'Sync request failed';
            allErrors.push(msg);
          }
        }
      }

      if (tokenExpired) {
        // Halt backoff when token expired; re-auth handler will resume sync
        this.retryAttempt = 0;
        this.currentBackoffMs = 0;
      } else if (allErrors.length > 0 && totalSynced === 0) {
        // All failed due to network: schedule exponential backoff
        this.scheduleBackoffRetry(specificTripId);
      } else {
        // Success or partial success
        this.retryAttempt = 0;
        this.currentBackoffMs = 0;
        this.lastSyncAt = new Date().toISOString();
      }
    } finally {
      this.isSyncing = false;
      await this.broadcastStatus();
    }

    return {
      syncedCount: totalSynced,
      failedCount: totalFailed,
      errors: allErrors,
      tokenExpired,
    };
  }

  /**
   * Schedule exponential backoff retry
   */
  private scheduleBackoffRetry(specificTripId?: string): void {
    if (this.retryAttempt >= 5) {
      // Exceeded max retry attempts, wait for manual trigger or online event
      this.currentBackoffMs = 0;
      return;
    }

    const baseDelay = 1000 * Math.pow(2, this.retryAttempt);
    const jitter = Math.random() * 500;
    const delay = Math.min(baseDelay + jitter, 30000); // Max 30s

    this.currentBackoffMs = Math.round(delay);
    this.retryAttempt++;

    if (this.backoffTimer) {
      clearTimeout(this.backoffTimer);
    }

    this.backoffTimer = setTimeout(() => {
      this.backoffTimer = null;
      this.currentBackoffMs = 0;
      this.syncAllPending(specificTripId);
    }, delay);
  }

  /**
   * Manual Sync Now action triggered by Conductor
   */
  public async syncNow(specificTripId?: string): Promise<{
    syncedCount: number;
    failedCount: number;
    errors: string[];
    tokenExpired?: boolean;
  }> {
    if (this.backoffTimer) {
      clearTimeout(this.backoffTimer);
      this.backoffTimer = null;
    }
    this.retryAttempt = 0;
    this.currentBackoffMs = 0;
    return this.syncAllPending(specificTripId);
  }
}

// Global Singleton Instance
export const syncEngine = new SyncEngine();
