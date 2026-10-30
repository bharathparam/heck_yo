import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RoleGuard } from '../features/auth/RoleGuard';
import { DispatchCentrePage } from '../features/dispatch/DispatchCentrePage';
import { apiClient, ApiError } from '../services/apiClient';
import type { Trip, Bus, Conductor } from '../types';

vi.mock('../services/apiClient', () => {
  return {
    apiClient: {
      getTrips: vi.fn(),
      getBuses: vi.fn(),
      getConductors: vi.fn(),
      assignTrip: vi.fn(),
    },
    ApiError: class extends Error {
      constructor(public status: number, message: string) {
        super(message);
        this.name = 'ApiError';
      }
    },
  };
});

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('Admin Dashboard Operations Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Role Guards', () => {
    it('restricts access for unauthorized passenger role', () => {
      render(
        <RoleGuard userRole="PASSENGER" allowedRoles={['OPERATOR', 'ADMIN']}>
          <div data-testid="protected-content">Secret Operations Center</div>
        </RoleGuard>
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
      expect(screen.getByText(/PASSENGER/)).toBeInTheDocument();
    });

    it('grants access for OPERATOR and ADMIN roles', () => {
      const { rerender } = render(
        <RoleGuard userRole="OPERATOR" allowedRoles={['OPERATOR', 'ADMIN']}>
          <div data-testid="protected-content">Secret Operations Center</div>
        </RoleGuard>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();

      rerender(
        <RoleGuard userRole="ADMIN" allowedRoles={['OPERATOR', 'ADMIN']}>
          <div data-testid="protected-content">Secret Operations Center</div>
        </RoleGuard>
      );
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  describe('Dispatch Centre Workflow', () => {
    const mockTripThresholdMet: Trip = {
      id: 'trip-chamundi-01',
      route_id: 'route-mys-01',
      destination: 'Nanjangud Town',
      origin: 'Mysuru Jn',
      status: 'THRESHOLD_MET',
      demand_count: 22,
      confirmed_bookings_count: 22,
      target_threshold: 20,
      capacity: 35,
      seats_remaining: 13,
      boarded_count: 0,
      base_fare: 45,
      travel_date: '2026-11-01',
      train_number: '16216',
    };

    const mockBuses: Bus[] = [
      {
        id: 'bus-1',
        registration_number: 'KA-09-F-1001',
        capacity: 35,
        model: 'Tata Marcopolo',
        status: 'AVAILABLE',
        created_at: '2026-01-01',
      },
    ];

    const mockConductors: Conductor[] = [
      {
        id: 'cond-1',
        full_name: 'Rajesh Kumar',
        phone: '9876543210',
        email: 'conductor@railbus.com',
        status: 'AVAILABLE',
      },
    ];

    it('successfully approves dispatch taking trip from THRESHOLD_MET to SCHEDULED', async () => {
      vi.mocked(apiClient.getTrips).mockResolvedValue([mockTripThresholdMet]);
      vi.mocked(apiClient.getBuses).mockResolvedValue(mockBuses);
      vi.mocked(apiClient.getConductors).mockResolvedValue(mockConductors);
      vi.mocked(apiClient.assignTrip).mockResolvedValue({
        ...mockTripThresholdMet,
        status: 'SCHEDULED',
        bus_id: 'bus-1',
        bus_registration: 'KA-09-F-1001',
        conductor_id: 'cond-1',
        conductor_name: 'Rajesh Kumar',
      });

      renderWithClient(<DispatchCentrePage />);

      // Verify trip queue renders
      await waitFor(() => {
        expect(screen.getByText('Ready for Dispatch (1)')).toBeInTheDocument();
        expect(screen.getByText('Mysuru Jn → Nanjangud Town')).toBeInTheDocument();
      });

      // Select bus and conductor
      const busBtn = screen.getByText('KA-09-F-1001');
      fireEvent.click(busBtn);

      const conductorBtn = screen.getByText('Rajesh Kumar');
      fireEvent.click(conductorBtn);

      // Click Approve & Schedule Dispatch button
      const approveBtn = screen.getByTestId('approve-dispatch-btn');
      fireEvent.click(approveBtn);

      // Verify assignTrip was called with the selected IDs
      await waitFor(() => {
        expect(apiClient.assignTrip).toHaveBeenCalledWith(
          'trip-chamundi-01',
          expect.objectContaining({
            bus_id: 'bus-1',
            conductor_id: 'cond-1',
          })
        );
      });

      // Verify success banner is shown
      await waitFor(() => {
        expect(screen.getByTestId('dispatch-success')).toHaveTextContent(
          'Trip to Nanjangud Town approved & scheduled! Bus and conductor assigned.'
        );
      });
    });

    it('displays backend assignment conflict errors verbatim', async () => {
      vi.mocked(apiClient.getTrips).mockResolvedValue([mockTripThresholdMet]);
      vi.mocked(apiClient.getBuses).mockResolvedValue(mockBuses);
      vi.mocked(apiClient.getConductors).mockResolvedValue(mockConductors);
      
      const verbatimBackendError =
        'Bus KA-09-F-1001 is already assigned to active trip trip-chamundi-99 (SCHEDULED)';
      vi.mocked(apiClient.assignTrip).mockRejectedValue(
        new ApiError(409, verbatimBackendError)
      );

      renderWithClient(<DispatchCentrePage />);

      await waitFor(() => {
        expect(screen.getByText('Ready for Dispatch (1)')).toBeInTheDocument();
      });

      // Click Approve
      const approveBtn = screen.getByTestId('approve-dispatch-btn');
      fireEvent.click(approveBtn);

      // Assert error alert displays backend error verbatim
      await waitFor(() => {
        const errorAlert = screen.getByTestId('dispatch-error');
        expect(errorAlert).toBeInTheDocument();
        expect(errorAlert).toHaveTextContent(verbatimBackendError);
      });
    });
  });
});
