import { openDB, type IDBPDatabase } from 'idb';
import type {
  ScanRecord,
  CachedManifestRecord,
  ConductorTripSummary,
  ManifestResponse,
} from '../types';

const DB_NAME = 'railbus_conductor_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export const getDB = (): Promise<IDBPDatabase> => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Scans Store
        if (!db.objectStoreNames.contains('scans')) {
          const scanStore = db.createObjectStore('scans', { keyPath: 'client_scan_id' });
          scanStore.createIndex('by-trip', 'trip_id');
          scanStore.createIndex('by-state', 'state');
          scanStore.createIndex('by-ticket', 'ticket_id');
          scanStore.createIndex('by-reference', 'ticket_reference');
        }

        // Cached Manifests Store
        if (!db.objectStoreNames.contains('cached_manifests')) {
          db.createObjectStore('cached_manifests', { keyPath: 'trip_id' });
        }

        // App Meta Store (Device ID, cached trips list, sync checkpoints)
        if (!db.objectStoreNames.contains('app_meta')) {
          db.createObjectStore('app_meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
};

/**
 * Reset DB connection (useful for tests)
 */
export const resetDBConnection = (): void => {
  dbPromise = null;
};

/**
 * Persistent Device ID generator & retrieval
 */
export const getDeviceId = async (): Promise<string> => {
  try {
    const db = await getDB();
    const meta = await db.get('app_meta', 'device_id');
    if (meta?.value) {
      return meta.value as string;
    }

    // Check localStorage fallback
    const localId = typeof localStorage !== 'undefined' ? localStorage.getItem('railbus_device_id') : null;
    const finalId = localId || `device_${crypto.randomUUID()}`;

    await db.put('app_meta', { key: 'device_id', value: finalId });
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('railbus_device_id', finalId);
    }
    return finalId;
  } catch {
    return 'conductor-offline-pwa';
  }
};

/**
 * Save a scan record into IndexedDB
 */
export const saveScan = async (scan: ScanRecord): Promise<void> => {
  const db = await getDB();
  await db.put('scans', scan);
};

/**
 * Update an existing scan record
 */
export const updateScan = async (
  clientScanId: string,
  updates: Partial<ScanRecord>
): Promise<void> => {
  const db = await getDB();
  const tx = db.transaction('scans', 'readwrite');
  const store = tx.objectStore('scans');
  const existing = await store.get(clientScanId);
  if (existing) {
    const updated = { ...existing, ...updates };
    await store.put(updated);
  }
  await tx.done;
};

/**
 * Retrieve a scan by client_scan_id
 */
export const getScan = async (clientScanId: string): Promise<ScanRecord | undefined> => {
  const db = await getDB();
  return db.get('scans', clientScanId);
};

/**
 * Retrieve all scans for a specific trip
 */
export const getScansForTrip = async (tripId: string): Promise<ScanRecord[]> => {
  const db = await getDB();
  const index = db.transaction('scans').store.index('by-trip');
  const scans = await index.getAll(tripId);
  // Sort descending by scanned_at
  return scans.sort((a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime());
};

/**
 * Retrieve pending scans (LOCAL_ACCEPTED or SYNCING)
 */
export const getPendingScans = async (tripId?: string): Promise<ScanRecord[]> => {
  const db = await getDB();
  const allScans = await db.getAll('scans');
  return allScans.filter((s) => {
    const matchesTrip = tripId ? s.trip_id === tripId : true;
    return matchesTrip && (s.state === 'LOCAL_ACCEPTED' || s.state === 'SYNCING');
  });
};

/**
 * Retrieve provisional scans specifically (state === 'LOCAL_ACCEPTED')
 */
export const getProvisionalScans = async (tripId: string): Promise<ScanRecord[]> => {
  const db = await getDB();
  const allScans = await db.getAll('scans');
  return allScans.filter((s) => s.trip_id === tripId && s.state === 'LOCAL_ACCEPTED');
};

/**
 * Retrieve unacknowledged rejected scans
 */
export const getUnacknowledgedRejectedScans = async (tripId?: string): Promise<ScanRecord[]> => {
  const db = await getDB();
  const allScans = await db.getAll('scans');
  return allScans.filter((s) => {
    const matchesTrip = tripId ? s.trip_id === tripId : true;
    return matchesTrip && s.state === 'REJECTED' && !s.acknowledged;
  });
};

/**
 * Conductor acknowledges rejected scans
 */
export const acknowledgeRejectedScans = async (scanIds: string[]): Promise<void> => {
  if (scanIds.length === 0) return;
  const db = await getDB();
  const tx = db.transaction('scans', 'readwrite');
  const store = tx.objectStore('scans');
  for (const id of scanIds) {
    const scan = await store.get(id);
    if (scan) {
      scan.acknowledged = true;
      await store.put(scan);
    }
  }
  await tx.done;
};

/**
 * Save Manifest Response into IndexedDB cache
 */
export const saveCachedManifest = async (manifestResp: ManifestResponse): Promise<void> => {
  const db = await getDB();
  const record: CachedManifestRecord = {
    trip_id: manifestResp.trip_id,
    route_name: manifestResp.route_name,
    bus_registration: manifestResp.bus_registration,
    status: manifestResp.status,
    total_passengers: manifestResp.total_passengers,
    boarded_count: manifestResp.boarded_count,
    cached_at: new Date().toISOString(),
    manifest: manifestResp.manifest,
  };
  await db.put('cached_manifests', record);
};

/**
 * Get Cached Manifest for a trip
 */
export const getCachedManifest = async (
  tripId: string
): Promise<CachedManifestRecord | undefined> => {
  const db = await getDB();
  return db.get('cached_manifests', tripId);
};

/**
 * Update cached manifest when a ticket is provisionally accepted offline
 */
export const updateCachedManifestBoarding = async (
  tripId: string,
  ticketIdOrRef: string,
  boardedAt: string
): Promise<void> => {
  const db = await getDB();
  const tx = db.transaction('cached_manifests', 'readwrite');
  const store = tx.objectStore('cached_manifests');
  const cached = await store.get(tripId);
  if (cached) {
    let updated = false;
    for (const item of cached.manifest) {
      if (item.ticket_id === ticketIdOrRef || item.ticket_reference === ticketIdOrRef) {
        if (item.status !== 'BOARDED') {
          item.status = 'BOARDED';
          item.boarded_at = boardedAt;
          item.is_provisional = true;
          cached.boarded_count += item.seat_count || 1;
          updated = true;
        }
        break;
      }
    }
    if (updated) {
      await store.put(cached);
    }
  }
  await tx.done;
};

/**
 * Cache assigned trips list for offline viewing
 */
export const saveCachedTrips = async (trips: ConductorTripSummary[]): Promise<void> => {
  const db = await getDB();
  await db.put('app_meta', { key: 'assigned_trips', value: trips, cached_at: new Date().toISOString() });
};

/**
 * Retrieve cached trips list
 */
export const getCachedTrips = async (): Promise<ConductorTripSummary[]> => {
  try {
    const db = await getDB();
    const meta = await db.get('app_meta', 'assigned_trips');
    return (meta?.value as ConductorTripSummary[]) || [];
  } catch {
    return [];
  }
};

/**
 * Clear DB (e.g., during tests)
 */
export const clearDatabase = async (): Promise<void> => {
  const db = await getDB();
  const stores = ['scans', 'cached_manifests', 'app_meta'];
  for (const s of stores) {
    if (db.objectStoreNames.contains(s)) {
      const tx = db.transaction(s, 'readwrite');
      await tx.objectStore(s).clear();
      await tx.done;
    }
  }
};
