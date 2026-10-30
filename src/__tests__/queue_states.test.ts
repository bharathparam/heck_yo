import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearDatabase,
  resetDBConnection,
  saveScan,
  getScan,
  updateScan,
  getPendingScans,
  getProvisionalScans,
} from '../services/db';
import type { ScanRecord } from '../types';

describe('IndexedDB Queue States', () => {
  const tripId = 'trip-alpha-001';

  beforeEach(async () => {
    resetDBConnection();
    await clearDatabase();
  });

  it('correctly persists scan records with required schema in IndexedDB', async () => {
    const scan: ScanRecord = {
      client_scan_id: 'scan-uuid-1',
      trip_id: tripId,
      ticket_id: 'tkt-123',
      ticket_reference: 'TKT-123',
      passenger_name: 'John Doe',
      seat_count: 1,
      scanned_at: new Date().toISOString(),
      device_id: 'device-test-1',
      state: 'LOCAL_ACCEPTED',
      reject_reason: null,
    };

    await saveScan(scan);
    const retrieved = await getScan('scan-uuid-1');

    expect(retrieved).toBeDefined();
    expect(retrieved?.client_scan_id).toBe('scan-uuid-1');
    expect(retrieved?.state).toBe('LOCAL_ACCEPTED');
    expect(retrieved?.trip_id).toBe(tripId);
    expect(retrieved?.device_id).toBe('device-test-1');
  });

  it('tracks distinct state transitions: LOCAL_ACCEPTED -> SYNCING -> SERVER_VALIDATED', async () => {
    const scan: ScanRecord = {
      client_scan_id: 'scan-transition-1',
      trip_id: tripId,
      ticket_id: 'tkt-456',
      ticket_reference: 'TKT-456',
      scanned_at: new Date().toISOString(),
      device_id: 'device-test-1',
      state: 'LOCAL_ACCEPTED',
      reject_reason: null,
    };

    await saveScan(scan);

    // Initial state: LOCAL_ACCEPTED
    let pending = await getPendingScans(tripId);
    let provisional = await getProvisionalScans(tripId);
    expect(pending.length).toBe(1);
    expect(provisional.length).toBe(1);
    expect(provisional[0].state).toBe('LOCAL_ACCEPTED');

    // Transition to SYNCING
    await updateScan('scan-transition-1', { state: 'SYNCING' });
    let updated = await getScan('scan-transition-1');
    expect(updated?.state).toBe('SYNCING');
    provisional = await getProvisionalScans(tripId);
    expect(provisional.length).toBe(0); // Not provisional anymore, it is syncing!
    pending = await getPendingScans(tripId);
    expect(pending.length).toBe(1); // Still pending sync completion

    // Transition to SERVER_VALIDATED
    await updateScan('scan-transition-1', { state: 'SERVER_VALIDATED' });
    updated = await getScan('scan-transition-1');
    expect(updated?.state).toBe('SERVER_VALIDATED');
    pending = await getPendingScans(tripId);
    expect(pending.length).toBe(0); // No longer pending
  });

  it('marks rejected scans with REJECTED state, reject_reason, and unacknowledged flag', async () => {
    const scan: ScanRecord = {
      client_scan_id: 'scan-reject-1',
      trip_id: tripId,
      ticket_id: 'tkt-invalid',
      ticket_reference: 'TKT-INVALID',
      scanned_at: new Date().toISOString(),
      device_id: 'device-test-1',
      state: 'REJECTED',
      reject_reason: 'Ticket not found in trip manifest.',
      acknowledged: false,
    };

    await saveScan(scan);
    const retrieved = await getScan('scan-reject-1');

    expect(retrieved?.state).toBe('REJECTED');
    expect(retrieved?.reject_reason).toBe('Ticket not found in trip manifest.');
    expect(retrieved?.acknowledged).toBe(false);
  });
});
