import type {
  Booking,
  BusRoute,
  NotificationItem,
  PassengerProfile,
  RouteStop,
  ServiceOption,
  Trip,
} from '../types';
import { getTicketsFromVault, saveTicketsToVault, clearTicketVault } from './ticketVault';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/railbus-api/api/v1').replace(/\/$/, '');
const TOKEN_KEY = 'railbus-token';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function getStoredToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token && isTokenExpired(token)) {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('railbus_user');
    window.dispatchEvent(new Event('railbus-auth-expired'));
    return null;
  }
  return token;
}

export function setStoredToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthCache(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('railbus_user');
  window.dispatchEvent(new Event('railbus-auth-expired'));
}

export function assertRequired<T>(value: T | null | undefined, name: string, context: string): T {
  if (value === null || value === undefined) {
    const message = `API contract violation: missing '${name}' in ${context}`;
    if (import.meta.env.DEV) {
      console.error(message);
      throw new Error(message);
    }
    throw new ApiError(500, `Unexpected server response: missing ${name}`);
  }
  return value;
}

async function request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getStoredToken();
  if (authenticated && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, `Cannot reach the RailBus API at ${API_BASE}. Please verify your connection.`);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && authenticated) {
      clearAuthCache();
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

export const api = {
  login: async (email: string, password: string): Promise<PassengerProfile> => {
    const data = await request<{ access_token: string; token_type: string } & PassengerProfile>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase(), password }) },
      false
    );
    assertRequired(data.access_token, 'access_token', 'login response');
    assertRequired(data.role, 'role', 'login response');
    setStoredToken(data.access_token);
    return {
      id: data.id || data.user_id,
      user_id: data.user_id || data.id,
      email: data.email,
      full_name: data.full_name,
      phone: data.phone,
      role: data.role,
      is_active: data.is_active,
      created_at: data.created_at,
    };
  },

  register: async (fullName: string, email: string, phone: string, password: string): Promise<PassengerProfile> => {
    const data = await request<{ access_token: string } & PassengerProfile>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
        }),
      },
      false
    );
    assertRequired(data.access_token, 'access_token', 'register response');
    setStoredToken(data.access_token);
    return {
      id: data.id || data.user_id,
      user_id: data.user_id || data.id,
      email: data.email,
      full_name: data.full_name,
      phone: data.phone,
      role: data.role,
      is_active: data.is_active,
      created_at: data.created_at,
    };
  },

  getMe: async (): Promise<PassengerProfile> => {
    const data = await request<PassengerProfile>('/auth/me');
    assertRequired(data.email, 'email', 'getMe profile');
    assertRequired(data.role, 'role', 'getMe profile');
    return data;
  },

  searchTrips: async (destination: string, trainNumber: string, travelDate: string): Promise<ServiceOption[]> => {
    const params = new URLSearchParams({
      destination: destination.trim(),
      train_number: trainNumber.trim(),
      travel_date: travelDate,
    });
    const results = await request<ServiceOption[]>(`/trips/search?${params.toString()}`);
    return results.map((item) => {
      assertRequired(item.route, 'route', 'trip search option');
      assertRequired(item.destination_stop, 'destination_stop', 'trip search option');
      assertRequired(item.status, 'status', 'trip search option');
      assertRequired(item.target_threshold, 'target_threshold', 'trip search option');
      return item;
    });
  },

  resolveTrip: async (
    routeId: string,
    destinationStopId: string,
    trainNumber: string,
    travelDate: string
  ): Promise<Trip> => {
    const trip = await request<Trip>('/trips/resolve', {
      method: 'POST',
      body: JSON.stringify({
        route_id: routeId,
        destination_stop_id: destinationStopId,
        train_number: trainNumber.trim().toUpperCase(),
        travel_date: travelDate,
      }),
    });
    assertRequired(trip.id, 'id', 'resolveTrip');
    assertRequired(trip.status, 'status', 'resolveTrip');
    return trip;
  },

  createBooking: async (
    tripId: string,
    destinationStopId: string,
    seatCount: number,
    idempotencyKey?: string
  ): Promise<Booking> => {
    const booking = await request<Booking>('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        trip_id: tripId,
        destination_stop_id: destinationStopId,
        seat_count: seatCount,
        idempotency_key: idempotencyKey,
      }),
    });
    assertRequired(booking.id, 'id', 'createBooking');
    assertRequired(booking.booking_reference, 'booking_reference', 'createBooking');
    return booking;
  },

  payForReservation: async (
    tripId: string,
    destinationStopId: string,
    seatCount: number,
    bookingId?: string,
    idempotencyKey?: string,
    simulateFailure = false
  ): Promise<Booking> => {
    const booking = await request<Booking>('/payments/pay', {
      method: 'POST',
      body: JSON.stringify({
        trip_id: tripId,
        destination_stop_id: destinationStopId,
        seat_count: seatCount,
        booking_id: bookingId,
        idempotency_key: idempotencyKey,
        simulate_failure: simulateFailure,
      }),
    });
    assertRequired(booking.id, 'id', 'payForReservation');
    assertRequired(booking.status, 'status', 'payForReservation');
    return booking;
  },

  getBookings: async (currentTrips?: Trip[]): Promise<Booking[]> => {
    const bookings = await request<Booking[]>('/bookings');
    const user = JSON.parse(localStorage.getItem('railbus_user') || '{}');
    if (user?.id) {
      void saveTicketsToVault(user.id, bookings);
    }
    return bookings;
  },

  getTicket: async (ticketKey: string): Promise<Booking> => {
    return request<Booking>(`/tickets/${encodeURIComponent(ticketKey)}`);
  },

  getNotifications: async (): Promise<NotificationItem[]> => {
    return request<NotificationItem[]>('/notifications');
  },

  markNotificationRead: async (id: string): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>(`/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST',
    });
  },

  getRoutes: async (): Promise<BusRoute[]> => {
    return request<BusRoute[]>('/routes?limit=500');
  },

  getTrips: async (): Promise<Trip[]> => {
    return request<Trip[]>('/trips');
  },
};

export async function getOfflineTickets(): Promise<Booking[]> {
  const user = JSON.parse(localStorage.getItem('railbus_user') || '{}');
  return getTicketsFromVault(user?.id);
}

export async function clearOfflineTickets(): Promise<void> {
  const user = JSON.parse(localStorage.getItem('railbus_user') || '{}');
  await clearTicketVault(user?.id);
}
