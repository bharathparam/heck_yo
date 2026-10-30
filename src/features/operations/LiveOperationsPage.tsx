import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Users, CheckCircle2, X } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { Badge } from '../../components/ui/Badge';
import { StaleIndicator } from '../../components/ui/StaleIndicator';
import { EmptyState } from '../../components/ui/EmptyState';
import type { Trip } from '../../types';

export const LiveOperationsPage: React.FC = () => {
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  const {
    data: trips = [],
    isLoading,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ['trips'],
    queryFn: () => apiClient.getTrips(),
    refetchInterval: 10000,
  });

  // Query manifest when trip is selected
  const { data: manifest, isLoading: manifestLoading } = useQuery({
    queryKey: ['manifest', selectedTrip?.id],
    queryFn: () => (selectedTrip ? apiClient.getManifest(selectedTrip.id) : null),
    enabled: !!selectedTrip,
    refetchInterval: 5000,
  });

  // Filter for operations trips
  const liveTrips = trips.filter((t) =>
    ['SCHEDULED', 'BOARDING', 'DEPARTED', 'COMPLETED'].includes(t.status)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0B1F33] tracking-tight">
            Live Station Operations
          </h1>
          <p className="text-xs text-[#5A6E82]">
            Real-time passenger boarding vs confirmed headcount and gate dispatch
          </p>
        </div>
        <StaleIndicator
          dataUpdatedAt={dataUpdatedAt}
          isFetching={isFetching}
          onRefresh={() => refetch()}
        />
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-xs text-[#5A6E82]">Loading operations state...</div>
      ) : liveTrips.length === 0 ? (
        <EmptyState
          icon={<Activity className="w-6 h-6 text-[#5A6E82]" />}
          title="No Live Operations Active"
          description="There are currently no trips in SCHEDULED, BOARDING, or DEPARTED states. Assign trips in Dispatch Centre to begin passenger boarding."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {liveTrips.map((trip) => {
            const confirmed = trip.confirmed_bookings_count || 0;
            const boarded = trip.boarded_count || 0;
            const percentage =
              confirmed > 0 ? Math.min(100, Math.round((boarded / confirmed) * 100)) : 0;

            return (
              <div
                key={trip.id}
                className="bg-white rounded-2xl border border-[#D5DFE9] p-5 shadow-sm space-y-4 hover:border-[#0066CC]/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#0066CC]">
                    Train #{trip.train_number}
                  </span>
                  <Badge status={trip.status} />
                </div>

                <div>
                  <h3 className="text-sm font-black text-[#0B1F33]">
                    {trip.origin || 'Mysuru Jn'} &rarr; {trip.destination}
                  </h3>
                  <div className="text-[11px] text-[#5A6E82] mt-0.5">
                    Bus: <strong>{trip.bus_registration || 'Unassigned'}</strong> • Crew:{' '}
                    <strong>{trip.conductor_name || 'Assigned'}</strong>
                  </div>
                </div>

                {/* Headcount Progress */}
                <div className="p-3 bg-[#F8FAFC] rounded-xl border border-gray-100 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#5A6E82]">Boarded Headcount</span>
                    <span className="text-[#0B1F33]">
                      {boarded} / {confirmed} Passengers
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        percentage === 100 ? 'bg-green-600' : 'bg-[#0066CC]'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-[#5A6E82]">
                    <span>{percentage}% boarded</span>
                    <span>{confirmed - boarded} awaiting arrival</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedTrip(trip)}
                  className="w-full py-2 bg-blue-50 text-[#0066CC] hover:bg-blue-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Inspect Passenger Manifest</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Manifest Inspection Modal */}
      {selectedTrip && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-base font-black text-[#0B1F33]">Passenger Boarding Manifest</h3>
                <p className="text-xs text-[#5A6E82]">
                  {selectedTrip.destination} • Bus {selectedTrip.bus_registration || 'TBD'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTrip(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-[#5A6E82]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {manifestLoading ? (
              <div className="p-8 text-center text-xs text-[#5A6E82]">
                Loading passenger list...
              </div>
            ) : !manifest?.manifest || manifest.manifest.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#5A6E82]">
                No passengers booked on this manifest.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-[#5A6E82] px-2">
                  <span>Passenger Name</span>
                  <span>Boarding Status</span>
                </div>
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                  {manifest.manifest.map((p) => {
                    const isBoarded = p.status === 'BOARDED' || !!p.boarded_at;
                    return (
                      <div
                        key={p.ticket_id}
                        className="p-3 flex items-center justify-between bg-white text-xs"
                      >
                        <div>
                          <div className="font-bold text-[#0B1F33]">{p.passenger_name}</div>
                          <div className="text-[10px] text-[#5A6E82]">
                            Ref: {p.ticket_reference} • {p.seat_count} seat(s)
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isBoarded
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-100 text-[#5A6E82]'
                          }`}
                        >
                          {isBoarded ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : null}
                          <span>{isBoarded ? 'Boarded' : 'Not Boarded'}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTrip(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-[#0B1F33] font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
