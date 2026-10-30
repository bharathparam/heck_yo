import type {
  AuthUser,
  Bus,
  BusRoute,
  Conductor,
  ConductorTrip,
  Manifest,
  OperationalEvent,
  OperatorBooking,
  OperatorNotification,
  SmartSyncStatus,
  Trip,
  TripStatus,
  UserProfile,
} from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/railbus-api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const token = sessionStorage.getItem('railbus-token');
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (authenticated && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, `Cannot reach RailBus API at ${API_BASE}. Ensure backend is running.`);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && authenticated) {
      sessionStorage.removeItem('railbus-token');
      sessionStorage.removeItem('railbus-user');
      window.dispatchEvent(new Event('railbus-auth-expired'));
    }
    const detail = payload?.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((e: { msg?: string }) => e.msg || 'Invalid request').join('; ')
          : `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }

  return payload as T;
}

export const apiClient = {
  login: async (email: string, password: string): Promise<AuthUser> => {
    return request<AuthUser>(
      '/api/v1/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      },
      false
    );
  },

  me: async (): Promise<UserProfile> => {
    return request<UserProfile>('/api/v1/auth/me');
  },

  getTrips: async (status?: TripStatus | string): Promise<Trip[]> => {
    const q = status && status !== 'ALL' ? `?status=${encodeURIComponent(status)}` : '';
    return request<Trip[]>(`/api/v1/trips${q}`);
  },

  getTrip: async (id: string): Promise<Trip> => {
    return request<Trip>(`/api/v1/trips/${encodeURIComponent(id)}`);
  },

  assignTrip: async (
    tripId: string,
    body: { bus_id?: string | null; conductor_id?: string | null; departure_note?: string | null }
  ): Promise<Trip> => {
    return request<Trip>(`/api/v1/trips/${encodeURIComponent(tripId)}/assign`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  getBuses: async (): Promise<Bus[]> => {
    return request<Bus[]>('/api/v1/buses');
  },

  getConductors: async (): Promise<Conductor[]> => {
    return request<Conductor[]>('/api/v1/conductors');
  },

  getBookings: async (limit = 1000): Promise<OperatorBooking[]> => {
    return request<OperatorBooking[]>(`/api/v1/operator/bookings?limit=${limit}`);
  },

  getActivity: async (limit = 100): Promise<OperationalEvent[]> => {
    return request<OperationalEvent[]>(`/api/v1/operator/activity?limit=${limit}`);
  },

  getAuditEvents: async (limit = 100): Promise<OperationalEvent[]> => {
    return request<OperationalEvent[]>(`/api/v1/audit?limit=${limit}`);
  },

  getNotifications: async (): Promise<OperatorNotification[]> => {
    return request<OperatorNotification[]>('/api/v1/notifications');
  },

  getRoutes: async (): Promise<BusRoute[]> => {
    return request<BusRoute[]>('/api/v1/routes?limit=500');
  },

  getSmartSyncStatus: async (): Promise<SmartSyncStatus> => {
    return request<SmartSyncStatus>('/api/v1/smartsync/status');
  },

  getTrainIntelligence: async (): Promise<SmartSyncStatus> => {
    return request<SmartSyncStatus>('/api/v1/trains/intelligence');
  },

  getConductorTrips: async (): Promise<ConductorTrip[]> => {
    return request<ConductorTrip[]>('/api/v1/conductor/trips');
  },

  getManifest: async (tripId: string): Promise<Manifest> => {
    return request<Manifest>(`/api/v1/conductor/trips/${encodeURIComponent(tripId)}/manifest`);
  },

  openBoarding: async (tripId: string): Promise<unknown> => {
    return request<unknown>(`/api/v1/conductor/trips/${encodeURIComponent(tripId)}/boarding/open`, {
      method: 'POST',
    });
  },

  boardTicket: async (
    tripId: string,
    qrCode: string
  ): Promise<{ success: boolean; message: string }> => {
    return request<{ success: boolean; message: string }>(
      `/api/v1/conductor/trips/${encodeURIComponent(tripId)}/board`,
      {
        method: 'POST',
        body: JSON.stringify({ qr_code: qrCode }),
      }
    );
  },

  departTrip: async (tripId: string): Promise<unknown> => {
    return request<unknown>(`/api/v1/conductor/trips/${encodeURIComponent(tripId)}/depart`, {
      method: 'POST',
    });
  },

  completeTrip: async (tripId: string): Promise<unknown> => {
    return request<unknown>(`/api/v1/conductor/trips/${encodeURIComponent(tripId)}/complete`, {
      method: 'POST',
    });
  },
};
