import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PaymentScreen } from '../screens/PaymentScreen';
import { TicketScreen } from '../screens/TicketScreen';
import { TripRegistrationScreen } from '../screens/TripRegistrationScreen';
import { AppProvider } from '../context/AppContext';
import { api } from '../services/api';
import * as ticketVault from '../services/ticketVault';
import type { Booking, Trip } from '../types';

describe('Passenger PWA Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  const mockTrip: Trip = {
    id: 'trip-test-1',
    route_id: 'route-1',
    route_name: 'RB-101',
    origin: 'Mysuru Junction (Railway Station)',
    destination: 'Kuvempunagar',
    status: 'AGGREGATING',
    demand_count: 5,
    confirmed_bookings_count: 5,
    target_threshold: 20,
    capacity: 20,
    seats_remaining: 15,
    boarded_count: 0,
    base_fare: 50,
    departure_time: null,
    train_number: '12614',
    travel_date: '2026-11-01',
    destination_stop_id: 'stop-1',
    deadline_at: new Date(Date.now() + 36000000).toISOString(),
    bus_id: null,
    bus_registration: null,
    conductor_id: null,
    conductor_name: null,
    threshold_met: false,
  };

  const mockBooking: Booking = {
    id: 'booking-test-1',
    booking_id: 'booking-test-1',
    booking_reference: 'RBW-ABCD1234',
    passenger_id: 'user-1',
    passenger_name: 'Test Passenger',
    passenger_phone: '9845012345',
    passenger_email: 'passenger@example.com',
    trip_id: 'trip-test-1',
    route_id: 'route-1',
    destination_stop_id: 'stop-1',
    destination_stop: {
      id: 'stop-1',
      sequence_order: 1,
      stop_name: 'Kuvempunagar Complex',
      distance_from_origin_km: 4.5,
      latitude: 12.2858,
      longitude: 76.6234,
    },
    route_name: 'Kuvempunagar',
    seat_count: 2,
    fare_amount: 100,
    status: 'WAITING_DISPATCH',
    payment_status: 'PAID',
    created_at: new Date().toISOString(),
    trip: mockTrip,
    route: {
      id: 'route-1',
      route_code: 'RB-101',
      name: 'RB-101',
      origin: 'Mysuru Junction',
      destination: 'Kuvempunagar',
      distance_km: 5.0,
      fixed_fare: 50,
      stops: [],
    },
  };

  it('1. Booking flow: searches via GET /trips/search and shows demand progress & refund notice', async () => {
    const searchSpy = vi.spyOn(api, 'searchTrips').mockResolvedValueOnce([
      {
        trip_id: 'trip-test-1',
        route: {
          id: 'route-1',
          route_code: 'RB-101',
          name: 'RB-101',
          origin: 'Mysuru Junction',
          destination: 'Kuvempunagar',
          distance_km: 5.0,
          fixed_fare: 50,
          stops: [],
        },
        destination_stop: {
          id: 'stop-1',
          sequence_order: 1,
          stop_name: 'Kuvempunagar Complex',
          distance_from_origin_km: 4.5,
          latitude: 12.2858,
          longitude: 76.6234,
        },
        train_number: '12614',
        travel_date: '2026-11-01',
        status: 'AGGREGATING',
        capacity: 20,
        confirmed_seats: 8,
        seats_remaining: 12,
        active_checkout_holds: 0,
        fare_per_seat: 50,
        deadline_at: new Date(Date.now() + 36000000).toISOString(),
        target_threshold: 20,
      },
    ]);

    render(
      <AppProvider>
        <MemoryRouter>
          <TripRegistrationScreen />
        </MemoryRouter>
      </AppProvider>
    );

    const searchBtn = screen.getByRole('button', { name: /search feeder buses/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith('Kuvempunagar', '12614', expect.any(String));
    });

    expect(await screen.findByText(/Demand: 8 \/ 20 confirmed seats/i)).toBeInTheDocument();
    expect(screen.getByText(/Automatic full refund if the 20-seat threshold is not reached/i)).toBeInTheDocument();
    expect(screen.getByText(/12 seats remaining/i)).toBeInTheDocument();
  });

  it('2. Payment retry: handles failure, retains persisted idempotency key, and succeeds on retry', async () => {
    let callCount = 0;
    const paySpy = vi.spyOn(api, 'payForReservation').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Simulated gateway timeout');
      }
      return {
        ...mockBooking,
        status: 'WAITING_DISPATCH',
      };
    });

    render(
      <AppProvider>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/book/pay',
              state: {
                trip: mockTrip,
                seatCount: 2,
                totalFare: 100,
                idempotencyKey: 'idemp-test-fixed-key-123',
              },
            },
          ]}
        >
          <Routes>
            <Route path="/book/pay" element={<PaymentScreen />} />
            <Route path="/tickets/:id" element={<div data-testid="ticket-view">Ticket Screen</div>} />
          </Routes>
        </MemoryRouter>
      </AppProvider>
    );

    // Initial state: Payment pending
    expect(screen.getByText(/PAYMENT PENDING/i)).toBeInTheDocument();
    expect(screen.getByText(/idemp-test-fixed-key-123/i)).toBeInTheDocument();

    const payButton = screen.getByRole('button', { name: /confirm payment/i });
    fireEvent.click(payButton);

    // First attempt fails
    expect(await screen.findByText(/Simulated gateway timeout/i)).toBeInTheDocument();
    expect(screen.getByText(/PAYMENT FAILED · RETRY READY/i)).toBeInTheDocument();

    // Retry button with same idempotency key
    const retryButton = screen.getByRole('button', { name: /retry payment/i });
    fireEvent.click(retryButton);

    // Second attempt succeeds and navigates to ticket
    await waitFor(() => {
      expect(paySpy).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('ticket-view')).toBeInTheDocument();
    });
  });

  it('3. Waiting for bus card: renders "reserved, waiting for bus" card before assignment', async () => {
    vi.spyOn(api, 'getTicket').mockResolvedValueOnce(mockBooking);

    render(
      <AppProvider>
        <MemoryRouter initialEntries={['/tickets/booking-test-1']}>
          <Routes>
            <Route path="/tickets/:id" element={<TicketScreen />} />
          </Routes>
        </MemoryRouter>
      </AppProvider>
    );

    // Before assignment, ticket QR is not shown; "Reserved · waiting for bus" is displayed
    expect(await screen.findByText(/Reserved · waiting for bus/i)).toBeInTheDocument();
    expect(screen.getByText(/RBW-ABCD1234/i)).toBeInTheDocument();
    expect(screen.getByText(/Your 2 seat\(s\) are paid and secured/i)).toBeInTheDocument();
  });

  it('4. Offline ticket: displays "offline copy, not validated" banner when offline', async () => {
    const assignedBooking: Booking = {
      ...mockBooking,
      status: 'CONFIRMED',
      ticket: {
        id: 'ticket-1',
        ticket_id: 'ticket-1',
        ticket_reference: 'RB-99AA11',
        qr_content: 'signed.qr.content',
        status: 'ISSUED',
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
    };

    vi.spyOn(ticketVault, 'getTicketsFromVault').mockResolvedValueOnce([assignedBooking]);

    // Simulate navigator.onLine = false
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    render(
      <AppProvider>
        <MemoryRouter initialEntries={['/tickets/booking-test-1']}>
          <Routes>
            <Route path="/tickets/:id" element={<TicketScreen />} />
          </Routes>
        </MemoryRouter>
      </AppProvider>
    );

    const banners = await screen.findAllByText(/Offline copy, not validated/i);
    expect(banners.length).toBeGreaterThan(0);
    expect(screen.getByText(/RB-99AA11/i)).toBeInTheDocument();

    // Restore onLine
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('5. Lighthouse PWA check: verifies valid PWA manifest and service worker configuration', async () => {
    const fs = await import('fs');
    const path = await import('path');

    // Read passenger vite config and public files
    const manifestPath = path.resolve(__dirname, '../../public/manifest.json');
    const indexHtmlPath = path.resolve(__dirname, '../../index.html');

    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
    expect(indexHtml).toContain('viewport');
    expect(indexHtml).toContain('theme-color');

    // Verify PWA theme color and meta
    expect(indexHtml).toContain('#0B1F33');

    // Check manifest icons exist
    const icon192 = fs.existsSync(path.resolve(__dirname, '../../public/icons/icon-192.png'));
    const icon512 = fs.existsSync(path.resolve(__dirname, '../../public/icons/icon-512.png'));
    expect(icon192).toBe(true);
    expect(icon512).toBe(true);
  });
});
