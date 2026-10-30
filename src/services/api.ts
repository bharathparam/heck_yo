import type {
  ConductorTripSummary,
  ManifestResponse,
  BoardTicketResponse,
  OfflineBoardingItem,
  OfflineSyncBatchResponse,
  ConductorUser,
} from '../types';

const API_BASE = '/api/v1';

export const getStoredToken = (): string | null => {
  return localStorage.getItem('railbus_conductor_token');
};

export const setStoredToken = (token: string): void => {
  localStorage.setItem('railbus_conductor_token', token);
};

export const clearStoredAuth = (): void => {
  localStorage.removeItem('railbus_conductor_token');
  localStorage.removeItem('railbus_conductor_user');
};

export const getStoredUser = (): ConductorUser | null => {
  try {
    const raw = localStorage.getItem('railbus_conductor_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredUser = (user: ConductorUser): void => {
  localStorage.setItem('railbus_conductor_user', JSON.stringify(user));
};

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = 'API request failed';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail?.error || errJson.detail || errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = `HTTP ${response.status} ${response.statusText}`;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

// Authentication
export const apiLogin = async (email: string, password: string): Promise<{ token: string; user: ConductorUser }> => {
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

// Trips
export const apiGetAssignedTrips = async (): Promise<ConductorTripSummary[]> => {
  return apiRequest<ConductorTripSummary[]>('/conductor/trips');
};

// Manifest
export const apiGetManifest = async (tripId: string): Promise<ManifestResponse> => {
  return apiRequest<ManifestResponse>(`/conductor/trips/${tripId}/manifest`);
};

// Open Boarding
export const apiOpenBoarding = async (tripId: string): Promise<{ trip_id: string; status: string; message: string }> => {
  return apiRequest(`/conductor/trips/${tripId}/boarding/open`, {
    method: 'POST',
  });
};

// Board Ticket via QR scan
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
export const apiDepartTrip = async (tripId: string): Promise<{ status: string; message: string }> => {
  return apiRequest(`/conductor/trips/${tripId}/depart`, {
    method: 'POST',
  });
};

// Complete Trip
export const apiCompleteTrip = async (tripId: string): Promise<{ status: string; message: string }> => {
  return apiRequest(`/conductor/trips/${tripId}/complete`, {
    method: 'POST',
  });
};
