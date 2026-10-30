import {
  getCachedManifest,
  getScansForTrip,
  saveScan,
  updateCachedManifestBoarding,
  getDeviceId,
} from './db';
import type { ScanRecord, ValidationResult } from '../types';

/**
 * Helper to safely extract ticket identifier & trip identifier from QR code string
 */
export const parseQrCodeData = (
  qrString: string
): { ticketId: string; reference: string; tripId?: string } => {
  const trimmed = qrString.trim();

  // 1. Check if it is a signed string format: "base64Payload.signature"
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    try {
      // Decode base64 payload
      const payloadStr = atob(parts[0]);
      const payload = JSON.parse(payloadStr);
      return {
        ticketId: payload.ticket_id || payload.ticketId || trimmed,
        reference: payload.ticket_reference || payload.ticketRef || payload.reference || trimmed,
        tripId: payload.trip_id || payload.tripId,
      };
    } catch {
      // If not JSON base64, check standard split or fallback to raw
    }
  }

  // 2. Check if JSON string directly
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        ticketId: parsed.ticket_id || parsed.ticketId || trimmed,
        reference: parsed.ticket_reference || parsed.ticketRef || parsed.reference || trimmed,
        tripId: parsed.trip_id || parsed.tripId,
      };
    } catch {
      // Fallback
    }
  }

  // 3. Raw Ticket Reference or Ticket ID string (e.g. "TKT-52C1B818" or UUID)
  return {
    ticketId: trimmed,
    reference: trimmed,
  };
};

/**
 * Validates a scanned QR or manual ticket entry strictly against the cached manifest in IndexedDB.
 * Enforces local duplicate checks and marks validated tickets as provisional ('LOCAL_ACCEPTED').
 */
export const validateTicketOffline = async (
  tripId: string,
  rawInput: string
): Promise<ValidationResult> => {
  const now = new Date().toISOString();
  const deviceId = await getDeviceId();
  const clientScanId = crypto.randomUUID();

  const parsed = parseQrCodeData(rawInput);
  const candidateKey = parsed.reference || parsed.ticketId;

  // Retrieve cached manifest for this trip
  const cached = await getCachedManifest(tripId);

  // 1. Check if manifest is cached on device
  if (!cached || !cached.manifest || cached.manifest.length === 0) {
    const rejectReason = 'No offline manifest cached for this trip. Open trip while online first.';
    const rejectedRecord: ScanRecord = {
      client_scan_id: clientScanId,
      trip_id: tripId,
      ticket_id: parsed.ticketId,
      ticket_reference: candidateKey,
      scanned_at: now,
      device_id: deviceId,
      state: 'REJECTED',
      reject_reason: rejectReason,
      acknowledged: false,
    };
    await saveScan(rejectedRecord);
    return {
      valid: false,
      state: 'REJECTED',
      scanRecord: rejectedRecord,
      message: rejectReason,
      rejectReason,
    };
  }

  // 2. If QR specified a trip ID, verify it matches current trip
  if (parsed.tripId && parsed.tripId !== tripId) {
    const rejectReason = `Ticket belongs to a different trip (${parsed.tripId})`;
    const rejectedRecord: ScanRecord = {
      client_scan_id: clientScanId,
      trip_id: tripId,
      ticket_id: parsed.ticketId,
      ticket_reference: candidateKey,
      scanned_at: now,
      device_id: deviceId,
      state: 'REJECTED',
      reject_reason: rejectReason,
      acknowledged: false,
    };
    await saveScan(rejectedRecord);
    return {
      valid: false,
      state: 'REJECTED',
      scanRecord: rejectedRecord,
      message: rejectReason,
      rejectReason,
    };
  }

  // 3. Find matching ticket in cached manifest
  const manifestItem = cached.manifest.find(
    (item) =>
      item.ticket_id.toLowerCase() === parsed.ticketId.toLowerCase() ||
      item.ticket_reference.toLowerCase() === candidateKey.toLowerCase() ||
      item.ticket_id.toLowerCase() === candidateKey.toLowerCase()
  );

  if (!manifestItem) {
    const rejectReason = `Ticket not found in manifest: ${candidateKey}`;
    const rejectedRecord: ScanRecord = {
      client_scan_id: clientScanId,
      trip_id: tripId,
      ticket_id: parsed.ticketId,
      ticket_reference: candidateKey,
      scanned_at: now,
      device_id: deviceId,
      state: 'REJECTED',
      reject_reason: rejectReason,
      acknowledged: false,
    };
    await saveScan(rejectedRecord);
    return {
      valid: false,
      state: 'REJECTED',
      scanRecord: rejectedRecord,
      message: rejectReason,
      rejectReason,
    };
  }

  // 4. Check Duplicate in Cached Manifest (e.g., already boarded on server before going offline)
  if (manifestItem.status === 'BOARDED' && !manifestItem.is_provisional) {
    const rejectReason = `Duplicate scan: Ticket ${manifestItem.ticket_reference} already boarded!`;
    const rejectedRecord: ScanRecord = {
      client_scan_id: clientScanId,
      trip_id: tripId,
      ticket_id: manifestItem.ticket_id,
      ticket_reference: manifestItem.ticket_reference,
      passenger_name: manifestItem.passenger_name,
      seat_count: manifestItem.seat_count,
      scanned_at: now,
      device_id: deviceId,
      state: 'REJECTED',
      reject_reason: rejectReason,
      acknowledged: false,
    };
    await saveScan(rejectedRecord);
    return {
      valid: false,
      state: 'REJECTED',
      scanRecord: rejectedRecord,
      message: rejectReason,
      passengerName: manifestItem.passenger_name,
      ticketReference: manifestItem.ticket_reference,
      rejectReason,
    };
  }

  // 5. Check Duplicate in Local Scan Queue (already scanned offline during this duty)
  const existingScans = await getScansForTrip(tripId);
  const alreadyQueued = existingScans.find(
    (s) =>
      (s.ticket_id === manifestItem.ticket_id || s.ticket_reference === manifestItem.ticket_reference) &&
      (s.state === 'LOCAL_ACCEPTED' || s.state === 'SYNCING' || s.state === 'SERVER_VALIDATED')
  );

  if (alreadyQueued) {
    const stateLabel =
      alreadyQueued.state === 'SERVER_VALIDATED' ? 'validated on server' : 'locally accepted';
    const rejectReason = `Duplicate scan: Ticket ${manifestItem.ticket_reference} was already ${stateLabel}`;
    const rejectedRecord: ScanRecord = {
      client_scan_id: clientScanId,
      trip_id: tripId,
      ticket_id: manifestItem.ticket_id,
      ticket_reference: manifestItem.ticket_reference,
      passenger_name: manifestItem.passenger_name,
      seat_count: manifestItem.seat_count,
      scanned_at: now,
      device_id: deviceId,
      state: 'REJECTED',
      reject_reason: rejectReason,
      acknowledged: false,
    };
    await saveScan(rejectedRecord);
    return {
      valid: false,
      state: 'REJECTED',
      scanRecord: rejectedRecord,
      message: rejectReason,
      passengerName: manifestItem.passenger_name,
      ticketReference: manifestItem.ticket_reference,
      rejectReason,
    };
  }

  // 6. Valid Provisional Scan ('LOCAL_ACCEPTED')
  const provisionalRecord: ScanRecord = {
    client_scan_id: clientScanId,
    trip_id: tripId,
    ticket_id: manifestItem.ticket_id,
    ticket_reference: manifestItem.ticket_reference,
    passenger_name: manifestItem.passenger_name,
    seat_count: manifestItem.seat_count,
    scanned_at: now,
    device_id: deviceId,
    state: 'LOCAL_ACCEPTED',
    reject_reason: null,
  };

  // Save to IndexedDB
  await saveScan(provisionalRecord);

  // Update cached manifest so subsequent offline scans detect duplicate immediately
  await updateCachedManifestBoarding(tripId, manifestItem.ticket_id, now);

  return {
    valid: true,
    state: 'LOCAL_ACCEPTED',
    scanRecord: provisionalRecord,
    message: `Locally accepted: ${manifestItem.passenger_name} (${manifestItem.ticket_reference}). Marked PROVISIONAL until synced.`,
    passengerName: manifestItem.passenger_name,
    ticketReference: manifestItem.ticket_reference,
    seatCount: manifestItem.seat_count,
  };
};
