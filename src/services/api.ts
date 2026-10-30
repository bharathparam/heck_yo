import type {
  ConductorTripSummary,
  ManifestResponse,
  BoardTicketResponse,
  OfflineBoardingItem,
  OfflineSyncBatchResponse,
  ConductorUser,
} from '../types';
import { saveCachedManifest, saveCachedTrips, getCachedTrips, getCachedManifest } from './db';

const API_BASE = '/api/v1';

export class TokenExpiredError extends Error {
  constructor(message = 'Session token has expired. Re-authentication required.') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

export class ApiError extends Error {
  statusCode: number;
  errorCode?: string;

  constructor(message: string, statusCode: number, errorCode?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

// Token expired event subscribers
type TokenExpiredListener = () => void;
const tokenExpiredListeners: Set<TokenExpiredListener> = new Set();

export const onTokenExpired = (listener: TokenExpiredListener): (() => void) => {
  tokenExpiredListeners.add(listener);
  return () => {
    tokenExpiredListeners.delete(listener);
  };
};

export const notifyTokenExpired = (): void => {
  tokenExpiredListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('Error in token expired listener', e);
    }
  });
};

export const getStoredToken = (): string | null => {
  return typeof localStorage !== 'undefined' ? localStorage.getItem('railbus_conductor_token') : null;
};

export const setStoredToken = (token: string): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('railbus_conductor_token', token);
  }
};

export const clearStoredAuth = (): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('railbus_conductor_token');
    localStorage.removeItem('railbus_conductor_user');
  }
};

export const getStoredUser = (): ConductorUser | null => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('railbus_conductor_user') : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredUser = (user: ConductorUser): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('railbus_conductor_user', JSON.stringify(user));
  }
};

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (netErr: unknown) {
    const errMsg = netErr instanceof Error ? netErr.message : 'Network unreachable';
    throw new ApiError(errMsg, 0, 'NETWORK_ERROR');
  }

  if (!response.ok) {
    if (response.status === 401) {
      notifyTokenExpired();
      throw new TokenExpiredError();
    }

    let errorDetail = 'API request failed';
    let errorCode: string | undefined;
    try {
      const errJson = await response.json();
      errorDetail =
        errJson.detail?.error ||
        errJson.detail ||
        errJson.message ||
        (typeof errJson === 'string' ? errJson : JSON.stringify(errJson));
      errorCode = errJson.error_code || errJson.detail?.error_code;
    } catch {
      errorDetail = `HTTP ${response.status} ${response.statusText}`;
    }
    throw new ApiError(errorDetail, response.status, errorCode);
  }

  return response.json();
}

// Authentication
export const apiLogin = async (
  email: string,
  password: string
): Promise<{ token: string; user: ConductorUser }> => {
  const data = await apiRequest<{
    access_token: string;
    user_id: string;
    email: string;
    full_name: string;
    role: string;
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const user: ConductorUser = {
    id: data.user_id,
    email: data.email,
    full_name: data.full_name,
    role: data.role,
  };

  setStoredToken(data.access_token);
  setStoredUser(user);

  return { token: data.access_token, user };
};

// Trips (with offline fallback cache)
export const apiGetAssignedTrips = async (): Promise<ConductorTripSummary[]> => {
  try {
    const data = await apiRequest<ConductorTripSummary[]>('/conductor/trips');
    // Cache for offline usage
    await saveCachedTrips(data);
    return data;
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 0) {
      // Offline fallback: load from IndexedDB
      const cached = await getCachedTrips();
      if (cached && cached.length > 0) {
        return cached;
      }
    }
    throw err;
  }
};

// Manifest (caches to IndexedDB on online fetch)
export const apiGetManifest = async (tripId: string): Promise<ManifestResponse> => {
  try {
    const data = await apiRequest<ManifestResponse>(`/conductor/trips/${tripId}/manifest`);
    // Cache to IndexedDB when fetched online
    await saveCachedManifest(data);
    return data;
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 0) {
      // Offline fallback: read cached manifest from IndexedDB
      const cached = await getCachedManifest(tripId);
      if (cached) {
        return {
          trip_id: cached.trip_id,
          route_name: cached.route_name,
          bus_registration: cached.bus_registration,
          status: cached.status,
          total_passengers: cached.total_passengers,
          boarded_count: cached.boarded_count,
          manifest: cached.manifest,
        };
      }
    }
    throw err;
  }
};

// Open Boarding
export const apiOpenBoarding = async (
  tripId: string
): Promise<{ trip_id: string; status: string; message: string }> => {
  return apiRequest(`/conductor/trips/${tripId}/boarding/open`, {
    method: 'POST',
  });
};

// Board Ticket via QR scan (Online direct board)
export const apiBoardTicket = async (
  tripId: string,
  qrCode: string,
  deviceId: string = 'conductor-web'
): Promise<BoardTicketResponse> => {
  return apiRequest<BoardTicketResponse>(`/conductor/trips/${tripId}/board`, {
    method: 'POST',
    body: JSON.stringify({ qr_code: qrCode, device_id: deviceId }),
  });
};

// Sync Offline Batch
export const apiSyncOfflineBatch = async (
  tripId: string,
  boardings: OfflineBoardingItem[]
): Promise<OfflineSyncBatchResponse> => {
  return apiRequest<OfflineSyncBatchResponse>(`/conductor/trips/${tripId}/sync-offline`, {
    method: 'POST',
    body: JSON.stringify({
      trip_id: tripId,
      boardings: boardings.map((b) => ({
        ticket_id: b.ticket_id,
        boarded_at: b.boarded_at,
        device_id: b.device_id,
      })),
    }),
  });
};

// Depart Trip
export const apiDepartTrip = async (
  tripId: string
): Promise<{ status: string; message: string }> => {
  return apiRequest(`/conductor/trips/${tripId}/depart`, {
    method: 'POST',
  });
};

// Complete Trip
export const apiCompleteTrip = async (
  tripId: string
): Promise<{ status: string; message: string }> => {
  return apiRequest(`/conductor/trips/${tripId}/complete`, {
    method: 'POST',
  });
};
