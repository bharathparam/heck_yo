import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  clearDatabase,
  resetDBConnection,
  saveScan,
  getScan,
  getPendingScans,
} from '../services/db';
import { syncEngine } from '../services/syncEngine';
import * as api from '../services/api';
import type { ScanRecord, OfflineSyncBatchResponse } from '../types';

describe('Mid-Trip Token Expiry & Re-Authentication', () => {
  const tripId = 'trip-auth-test';

  beforeEach(async () => {
    resetDBConnection();
    await clearDatabase();
    vi.restoreAllMocks();
  });

  it('preserves offline queue when token expires and triggers onTokenExpired', async () => {
    const scan: ScanRecord = {
      client_scan_id: 'scan-token-exp-1',
      trip_id: tripId,
      ticket_id: 'tkt-token-1',
      ticket_reference: 'TKT-TOKEN-1',
      scanned_at: new Date().toISOString(),
      device_id: 'dev-1',
      state: 'LOCAL_ACCEPTED',
      reject_reason: null,
    };
    await saveScan(scan);

    let expiredListenerTriggered = false;
    const unsubscribe = api.onTokenExpired(() => {
      expiredListenerTriggered = true;
    });

    // Mock API 401 Unauthorized
    vi.spyOn(api, 'apiSyncOfflineBatch').mockImplementation(() => {
      api.notifyTokenExpired();
      return Promise.reject(new api.TokenExpiredError());
    });

    const result = await syncEngine.syncNow(tripId);

    expect(expiredListenerTriggered).toBe(true);
    expect(result.tokenExpired).toBe(true);

    // CRITICAL: Verify the queue was NOT cleared!
    const pending = await getPendingScans(tripId);
    expect(pending.length).toBe(1);
    expect(pending[0].client_scan_id).toBe('scan-token-exp-1');

    // Scans in SYNCING state should have rolled back safely to LOCAL_ACCEPTED
    const scanInDb = await getScan('scan-token-exp-1');
    expect(scanInDb?.state).toBe('LOCAL_ACCEPTED');

    unsubscribe();
  });

  it('resumes synchronization successfully after conductor re-authenticates', async () => {
    const scan: ScanRecord = {
      client_scan_id: 'scan-resume-1',
      trip_id: tripId,
      ticket_id: 'tkt-resume-1',
      ticket_reference: 'TKT-RESUME-1',
      scanned_at: new Date().toISOString(),
      device_id: 'dev-1',
      state: 'LOCAL_ACCEPTED',
      reject_reason: null,
    };
    await saveScan(scan);

    // Step 1: Simulate 401 on first sync attempt
    const syncBatchSpy = vi
      .spyOn(api, 'apiSyncOfflineBatch')
      .mockRejectedValueOnce(new api.TokenExpiredError());

    const firstResult = await syncEngine.syncNow(tripId);
    expect(firstResult.tokenExpired).toBe(true);

    // Queue still intact
    let item = await getScan('scan-resume-1');
    expect(item?.state).toBe('LOCAL_ACCEPTED');

    // Step 2: Conductor re-authenticates with new token
    api.setStoredToken('new_refreshed_access_token_xyz');

    // Mock successful sync batch response on second attempt
    const mockSuccessResponse: OfflineSyncBatchResponse = {
      trip_id: tripId,
      synced_count: 1,
      failed_count: 0,
      boarded_count: 1,
      total_passengers: 5,
      errors: [],
    };
    syncBatchSpy.mockResolvedValueOnce(mockSuccessResponse);
    vi.spyOn(api, 'apiGetManifest').mockResolvedValueOnce({
      trip_id: tripId,
      route_name: 'Test Route',
      status: 'BOARDING',
      total_passengers: 5,
      boarded_count: 1,
      manifest: [],
    });

    // Step 3: Resume sync
    const resumedResult = await syncEngine.syncNow(tripId);
    expect(resumedResult.syncedCount).toBe(1);
    expect(resumedResult.tokenExpired).toBe(false);

    // Verify item transitioned to SERVER_VALIDATED
    item = await getScan('scan-resume-1');
    expect(item?.state).toBe('SERVER_VALIDATED');
  });
});
