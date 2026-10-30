import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
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

describe('Reconnect Sync & Exponential Backoff', () => {
  const tripId = 'trip-sync-test';

  beforeEach(async () => {
    resetDBConnection();
    await clearDatabase();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    syncEngine.stop();
  });

  it('synchronizes provisional scans on reconnect and updates state to SERVER_VALIDATED', async () => {
    const scan1: ScanRecord = {
      client_scan_id: 'scan-sync-1',
      trip_id: tripId,
      ticket_id: 'tkt-101',
      ticket_reference: 'TKT-101',
      scanned_at: new Date().toISOString(),
      device_id: 'dev-1',
      state: 'LOCAL_ACCEPTED',
      reject_reason: null,
    };

    const scan2: ScanRecord = {
      client_scan_id: 'scan-sync-2',
      trip_id: tripId,
      ticket_id: 'tkt-102',
      ticket_reference: 'TKT-102',
      scanned_at: new Date().toISOString(),
      device_id: 'dev-1',
      state: 'LOCAL_ACCEPTED',
      reject_reason: null,
    };

    await saveScan(scan1);
    await saveScan(scan2);

    const pendingBefore = await getPendingScans(tripId);
    expect(pendingBefore.length).toBe(2);

    // Mock API sync batch response
    const mockBatchResponse: OfflineSyncBatchResponse = {
      trip_id: tripId,
      synced_count: 2,
      failed_count: 0,
      boarded_count: 2,
      total_passengers: 10,
      errors: [],
    };

    vi.spyOn(api, 'apiSyncOfflineBatch').mockResolvedValue(mockBatchResponse);
    vi.spyOn(api, 'apiGetManifest').mockResolvedValue({
      trip_id: tripId,
      route_name: 'Test Route',
      status: 'BOARDING',
      total_passengers: 10,
      boarded_count: 2,
      manifest: [],
    });

    const result = await syncEngine.syncNow(tripId);

    expect(result.syncedCount).toBe(2);
    expect(result.failedCount).toBe(0);

    const updatedScan1 = await getScan('scan-sync-1');
    const updatedScan2 = await getScan('scan-sync-2');

    expect(updatedScan1?.state).toBe('SERVER_VALIDATED');
    expect(updatedScan2?.state).toBe('SERVER_VALIDATED');

    const pendingAfter = await getPendingScans(tripId);
    expect(pendingAfter.length).toBe(0);
  });

  it('marks failed items as REJECTED with specific server error while validating remaining items', async () => {
    const scan1: ScanRecord = {
      client_scan_id: 'scan-ok',
      trip_id: tripId,
      ticket_id: 'tkt-ok',
      ticket_reference: 'TKT-OK',
      scanned_at: new Date().toISOString(),
      device_id: 'dev-1',
      state: 'LOCAL_ACCEPTED',
      reject_reason: null,
    };

    const scan2: ScanRecord = {
      client_scan_id: 'scan-err',
      trip_id: tripId,
      ticket_id: 'tkt-invalid-remote',
      ticket_reference: 'TKT-INVALID-REMOTE',
      scanned_at: new Date().toISOString(),
      device_id: 'dev-1',
      state: 'LOCAL_ACCEPTED',
      reject_reason: null,
    };

    await saveScan(scan1);
    await saveScan(scan2);

    const mockBatchResponse: OfflineSyncBatchResponse = {
      trip_id: tripId,
      synced_count: 1,
      failed_count: 1,
      boarded_count: 1,
      total_passengers: 10,
      errors: ['Ticket tkt-invalid-remote not found'],
    };

    vi.spyOn(api, 'apiSyncOfflineBatch').mockResolvedValue(mockBatchResponse);
    vi.spyOn(api, 'apiGetManifest').mockResolvedValue({
      trip_id: tripId,
      route_name: 'Test Route',
      status: 'BOARDING',
      total_passengers: 10,
      boarded_count: 1,
      manifest: [],
    });

    const result = await syncEngine.syncNow(tripId);

    expect(result.syncedCount).toBe(1);
    expect(result.failedCount).toBe(1);

    const okScan = await getScan('scan-ok');
    const errScan = await getScan('scan-err');

    expect(okScan?.state).toBe('SERVER_VALIDATED');
    expect(errScan?.state).toBe('REJECTED');
    expect(errScan?.reject_reason).toContain('Ticket tkt-invalid-remote not found');
    expect(errScan?.acknowledged).toBe(false);
  });

  it('reverts scans to LOCAL_ACCEPTED when network error occurs during sync', async () => {
    const scan: ScanRecord = {
      client_scan_id: 'scan-net-fail',
      trip_id: tripId,
      ticket_id: 'tkt-1',
      ticket_reference: 'TKT-1',
      scanned_at: new Date().toISOString(),
      device_id: 'dev-1',
      state: 'LOCAL_ACCEPTED',
      reject_reason: null,
    };
    await saveScan(scan);

    vi.spyOn(api, 'apiSyncOfflineBatch').mockRejectedValue(new Error('Network offline or timeout'));

    const result = await syncEngine.syncNow(tripId);
    expect(result.syncedCount).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);

    const retrieved = await getScan('scan-net-fail');
    // Must be preserved as LOCAL_ACCEPTED so it is ready for next retry
    expect(retrieved?.state).toBe('LOCAL_ACCEPTED');
  });
});
