export type TripStatus =
  | 'AGGREGATING'
  | 'THRESHOLD_MET'
  | 'SCHEDULED'
  | 'BOARDING'
  | 'DEPARTED'
  | 'COMPLETED'
  | 'CANCELLED';

export type TicketStatus = 'ISSUED' | 'BOARDED' | 'EXPIRED' | 'CANCELLED';

export type ScanState =
  | 'LOCAL_ACCEPTED'
  | 'SYNCING'
  | 'SERVER_VALIDATED'
  | 'REJECTED';

export interface ConductorUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface ConductorTripSummary {
  id: string;
  route_name: string;
  origin: string;
  destination: string;
  status: TripStatus;
  bus_registration?: string;
  capacity: number;
  boarded_count: number;
  total_confirmed_passengers: number;
  departure_time?: string;
}

export interface PassengerManifestItem {
  ticket_id: string;
  ticket_reference: string;
  passenger_name: string;
  passenger_phone?: string;
  seat_count: number;
  status: TicketStatus;
  boarded_at?: string;
  // Local provisional boarding tracking
  is_provisional?: boolean;
}

export interface ManifestResponse {
  trip_id: string;
  route_name: string;
  bus_registration?: string;
  status: TripStatus;
  total_passengers: number;
  boarded_count: number;
  manifest: PassengerManifestItem[];
}

export interface BoardTicketResponse {
  success: boolean;
  ticket_id: string;
  ticket_reference: string;
  passenger_name: string;
  boarded_at: string;
  boarded_count: number;
  total_passengers: number;
  message: string;
}

export interface OfflineBoardingItem {
  ticket_id: string;
  ticket_reference?: string;
  passenger_name?: string;
  boarded_at: string;
  device_id: string;
}

export interface OfflineSyncBatchResponse {
  trip_id: string;
  synced_count: number;
  failed_count: number;
  boarded_count: number;
  total_passengers: number;
  errors: string[];
}

/**
 * IndexedDB Scan Record Schema
 * Each scan record: client_scan_id (UUID), trip_id, ticket_id or reference,
 * scanned_at, device_id, state (LOCAL_ACCEPTED, SYNCING, SERVER_VALIDATED, REJECTED)
 * and reject_reason.
 */
export interface ScanRecord {
  client_scan_id: string; // UUID
  trip_id: string;
  ticket_id: string;
  ticket_reference: string;
  passenger_name?: string;
  seat_count?: number;
  scanned_at: string; // ISO 8601
  device_id: string;
  state: ScanState;
  reject_reason?: string | null;
  acknowledged?: boolean; // For conductor to acknowledge rejected scans
}

export interface CachedManifestRecord {
  trip_id: string;
  route_name: string;
  bus_registration?: string;
  status: TripStatus;
  total_passengers: number;
  boarded_count: number;
  cached_at: string;
  manifest: PassengerManifestItem[];
}

export interface ValidationResult {
  valid: boolean;
  state: ScanState;
  scanRecord: ScanRecord;
  message: string;
  passengerName?: string;
  ticketReference?: string;
  seatCount?: number;
  rejectReason?: string;
}

export interface SyncEngineStatus {
  isSyncing: boolean;
  pendingCount: number; // LOCAL_ACCEPTED + SYNCING
  provisionalCount: number; // LOCAL_ACCEPTED
  serverValidatedCount: number;
  rejectedCount: number;
  lastSyncAt: string | null;
  backoffDelayMs?: number;
  retryAttempt?: number;
}
