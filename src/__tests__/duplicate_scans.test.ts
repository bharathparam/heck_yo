import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearDatabase,
  resetDBConnection,
  saveCachedManifest,
  getScansForTrip,
} from '../services/db';
import { validateTicketOffline } from '../services/offlineValidation';
import type { ManifestResponse } from '../types';

describe('Offline Validation & Duplicate Scans', () => {
  const tripId = 'trip-route-99';

  const mockManifest: ManifestResponse = {
    trip_id: tripId,
    route_name: 'Bangalore to Mysore RailBus Express',
    status: 'BOARDING',
    total_passengers: 2,
    boarded_count: 0,
    manifest: [
      {
        ticket_id: 'tkt-001',
        ticket_reference: 'TKT-BM-001',
        passenger_name: 'Ananya Sharma',
        seat_count: 1,
        status: 'ISSUED',
      },
      {
        ticket_id: 'tkt-002',
        ticket_reference: 'TKT-BM-002',
        passenger_name: 'Rohan Verma',
        seat_count: 1,
        status: 'BOARDED', // Already boarded on server prior to going offline
        boarded_at: '2026-10-30T10:00:00Z',
      },
    ],
  };

  beforeEach(async () => {
    resetDBConnection();
    await clearDatabase();
    await saveCachedManifest(mockManifest);
  });

  it('accepts valid unboarded ticket as provisional LOCAL_ACCEPTED', async () => {
    const result = await validateTicketOffline(tripId, 'TKT-BM-001');

    expect(result.valid).toBe(true);
    expect(result.state).toBe('LOCAL_ACCEPTED');
    expect(result.passengerName).toBe('Ananya Sharma');
    expect(result.ticketReference).toBe('TKT-BM-001');

    const scans = await getScansForTrip(tripId);
    expect(scans.length).toBe(1);
    expect(scans[0].state).toBe('LOCAL_ACCEPTED');
  });

  it('rejects duplicate scan if ticket was already scanned offline in current duty', async () => {
    // First scan: accepted
    const firstScan = await validateTicketOffline(tripId, 'TKT-BM-001');
    expect(firstScan.valid).toBe(true);
    expect(firstScan.state).toBe('LOCAL_ACCEPTED');

    // Second scan with same reference: must be rejected locally!
    const secondScan = await validateTicketOffline(tripId, 'TKT-BM-001');
    expect(secondScan.valid).toBe(false);
    expect(secondScan.state).toBe('REJECTED');
    expect(secondScan.rejectReason).toContain('already');

    // Third scan with ticket_id instead of reference: also rejected as duplicate
    const thirdScan = await validateTicketOffline(tripId, 'tkt-001');
    expect(thirdScan.valid).toBe(false);
    expect(thirdScan.state).toBe('REJECTED');
  });

  it('rejects duplicate scan if ticket was already boarded in cached manifest', async () => {
    // Ticket TKT-BM-002 was already BOARDED in manifest
    const result = await validateTicketOffline(tripId, 'TKT-BM-002');

    expect(result.valid).toBe(false);
    expect(result.state).toBe('REJECTED');
    expect(result.rejectReason).toContain('already boarded');
  });

  it('rejects scan if ticket is not present in cached manifest', async () => {
    const result = await validateTicketOffline(tripId, 'TKT-UNKNOWN-999');

    expect(result.valid).toBe(false);
    expect(result.state).toBe('REJECTED');
    expect(result.rejectReason).toContain('Ticket not found in manifest');
  });

  it('rejects scan if QR encodes a different trip ID', async () => {
    // Signed QR format with different trip_id
    const payload = JSON.stringify({
      ticket_id: 'tkt-001',
      ticket_reference: 'TKT-BM-001',
      trip_id: 'different-trip-404',
    });
    const fakeQr = `${btoa(payload)}.fakesignature`;

    const result = await validateTicketOffline(tripId, fakeQr);
    expect(result.valid).toBe(false);
    expect(result.state).toBe('REJECTED');
    expect(result.rejectReason).toContain('different trip');
  });
});
