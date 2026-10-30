import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, CheckCircle2, AlertTriangle, Clock, Train, Check } from 'lucide-react';
import { apiClient, ApiError } from '../../services/apiClient';
import { BusPicker } from './BusPicker';
import { ConductorPicker } from './ConductorPicker';
import { Badge } from '../../components/ui/Badge';
import { StaleIndicator } from '../../components/ui/StaleIndicator';
import { EmptyState } from '../../components/ui/EmptyState';
import type { Trip } from '../../types';

export const DispatchCentrePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<string>('');
  const [selectedConductorId, setSelectedConductorId] = useState<string>('');
  const [departureNote, setDepartureNote] = useState<string>(
    'Dispatched on schedule from Mysuru Jn'
  );
  const [verbatimError, setVerbatimError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // TanStack Query: Trips
  const {
    data: allTrips = [],
    isLoading: tripsLoading,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ['trips'],
    queryFn: () => apiClient.getTrips(),
    refetchInterval: 10000,
  });

  // Filter queue for THRESHOLD_MET / READY_TO_DISPATCH
  const dispatchQueue = allTrips.filter(
    (t) => t.status === 'THRESHOLD_MET' || t.status === 'READY_TO_DISPATCH'
  );

  // TanStack Query: Buses & Conductors
  const { data: buses = [] } = useQuery({
    queryKey: ['buses'],
    queryFn: () => apiClient.getBuses(),
    refetchInterval: 15000,
  });

  const { data: conductors = [] } = useQuery({
    queryKey: ['conductors'],
    queryFn: () => apiClient.getConductors(),
    refetchInterval: 15000,
  });

  // Active selected trip
  const activeTrip: Trip | undefined =
    dispatchQueue.find((t) => t.id === selectedTripId) || dispatchQueue[0];

  const currentTripId = activeTrip?.id || '';

  // Mutation for assign/approve dispatch
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!currentTripId) throw new Error('No trip selected');
      setVerbatimError(null);
      setSuccessMessage(null);
      return apiClient.assignTrip(currentTripId, {
        bus_id: selectedBusId || null,
        conductor_id: selectedConductorId || null,
        departure_note: departureNote || null,
      });
    },
    onSuccess: (updatedTrip) => {
      setSuccessMessage(
        `Trip to ${updatedTrip.destination} approved & scheduled! Bus and conductor assigned.`
      );
      setSelectedBusId('');
      setSelectedConductorId('');
      // Invalidate queries so queue updates immediately
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['buses'] });
      queryClient.invalidateQueries({ queryKey: ['conductors'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        // Display backend error verbatim
        setVerbatimError(err.message);
      } else if (err instanceof Error) {
        setVerbatimError(err.message);
      } else {
        setVerbatimError('Unknown dispatch assignment error');
      }
    },
  });

  const handleApprove = (e: React.FormEvent) => {
    e.preventDefault();
    assignMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0B1F33] tracking-tight">Dispatch Centre</h1>
          <p className="text-xs text-[#5A6E82]">
            Assign buses and crew to demand trips reaching target passenger thresholds
          </p>
        </div>
        <StaleIndicator
          dataUpdatedAt={dataUpdatedAt}
          isFetching={isFetching}
          onRefresh={() => refetch()}
        />
      </div>

      {verbatimError && (
        <div
          data-testid="dispatch-error"
          className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Assignment Conflict / Error:</span>
            <span className="font-mono text-red-700">{verbatimError}</span>
          </div>
        </div>
      )}

      {successMessage && (
        <div
          data-testid="dispatch-success"
          className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-900 text-xs flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="font-bold">{successMessage}</span>
        </div>
      )}

      {tripsLoading ? (
        <div className="p-12 text-center text-xs text-[#5A6E82]">Loading dispatch queue...</div>
      ) : dispatchQueue.length === 0 ? (
        <EmptyState
          icon={<Send className="w-6 h-6 text-[#5A6E82]" />}
          title="Dispatch Queue Clear"
          description="All trips with met thresholds have been scheduled or departed. New trips will appear here automatically when booking thresholds are met."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Trip Queue Column */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0B1F33] uppercase tracking-wider">
                Ready for Dispatch ({dispatchQueue.length})
              </span>
              <span className="text-[10px] text-[#5A6E82]">Select a trip to schedule</span>
            </div>

            <div className="space-y-2">
              {dispatchQueue.map((trip) => {
                const isSelected =
                  trip.id === selectedTripId || (!selectedTripId && trip === dispatchQueue[0]);
                return (
                  <button
                    key={trip.id}
                    type="button"
                    onClick={() => {
                      setSelectedTripId(trip.id);
                      setVerbatimError(null);
                      setSuccessMessage(null);
                    }}
                    className={`w-full p-4 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-[#F5A524] bg-white ring-2 ring-[#F5A524]/20 shadow-md'
                        : 'border-[#D5DFE9] bg-white hover:border-[#F5A524]/50 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Train className="w-4 h-4 text-[#0066CC]" />
                        <span className="text-xs font-bold text-[#0B1F33]">
                          Train #{trip.train_number}
                        </span>
                      </div>
                      <Badge status={trip.status} />
                    </div>

                    <div className="text-sm font-black text-[#0B1F33]">
                      {trip.origin || 'Mysuru Jn'} &rarr; {trip.destination}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-[#5A6E82] pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-1 font-semibold text-green-700">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>
                          {trip.confirmed_bookings_count} / {trip.target_threshold} Bookings
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{trip.travel_date}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assignment Workspace */}
          {activeTrip && (
            <div className="lg:col-span-7 bg-white rounded-2xl border border-[#D5DFE9] p-5 shadow-sm space-y-5">
              <div className="border-b border-[#E2E8F0] pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#F5A524] uppercase tracking-wider">
                    Dispatch Assignment Form
                  </span>
                  <span className="text-xs text-[#5A6E82]">
                    Trip ID: {activeTrip.id.slice(0, 8)}...
                  </span>
                </div>
                <h2 className="text-base font-black text-[#0B1F33] mt-1">
                  {activeTrip.origin || 'Mysuru Jn'} to {activeTrip.destination}
                </h2>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-[#5A6E82]">
                  <span>
                    Train: <strong>#{activeTrip.train_number}</strong>
                  </span>
                  <span>
                    Date: <strong>{activeTrip.travel_date}</strong>
                  </span>
                  <span>
                    Demand:{' '}
                    <strong className="text-green-700">
                      {activeTrip.confirmed_bookings_count} confirmed
                    </strong>
                  </span>
                </div>
              </div>

              <form onSubmit={handleApprove} className="space-y-5">
                {/* Bus Picker */}
                <BusPicker
                  buses={buses}
                  selectedBusId={selectedBusId}
                  onSelect={(id) => {
                    setSelectedBusId(id);
                    setVerbatimError(null);
                  }}
                  disabled={assignMutation.isPending}
                />

                {/* Conductor Picker */}
                <ConductorPicker
                  conductors={conductors}
                  selectedConductorId={selectedConductorId}
                  onSelect={(id) => {
                    setSelectedConductorId(id);
                    setVerbatimError(null);
                  }}
                  disabled={assignMutation.isPending}
                />

                {/* Dispatch Notes */}
                <div>
                  <label className="block text-xs font-bold text-[#0B1F33] uppercase tracking-wider mb-1.5">
                    Operations / Gate Note
                  </label>
                  <input
                    type="text"
                    value={departureNote}
                    onChange={(e) => setDepartureNote(e.target.value)}
                    placeholder="e.g. Platform 1 bay 3, departing 10 mins post-train arrival"
                    className="w-full border border-[#D5DFE9] rounded-xl px-3 py-2 text-xs text-[#0B1F33] focus:outline-none focus:border-[#0066CC]"
                  />
                </div>

                {/* Approve Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={assignMutation.isPending}
                    data-testid="approve-dispatch-btn"
                    className="w-full bg-[#00875A] hover:bg-[#007048] text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {assignMutation.isPending
                        ? 'Validating & Approving...'
                        : 'Approve & Schedule Dispatch'}
                    </span>
                  </button>
                  <p className="text-[10px] text-[#5A6E82] text-center mt-2">
                    Takes trip to <strong>SCHEDULED</strong>, generates QR codes, and dispatches
                    manifest.
                  </p>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
