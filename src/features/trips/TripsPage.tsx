import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Filter, Eye, X } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { Badge } from '../../components/ui/Badge';
import { StaleIndicator } from '../../components/ui/StaleIndicator';
import { EmptyState } from '../../components/ui/EmptyState';
import { RouteMap } from '../../components/map/RouteMap';
import type { Trip, BusRoute } from '../../types';

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All Trips', value: 'ALL' },
  { label: 'Aggregating', value: 'AGGREGATING' },
  { label: 'Threshold Met', value: 'THRESHOLD_MET' },
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Boarding', value: 'BOARDING' },
  { label: 'Departed', value: 'DEPARTED' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

export const TripsPage: React.FC = () => {
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);

  const {
    data: trips = [],
    isLoading,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ['trips', selectedStatus],
    queryFn: () => apiClient.getTrips(selectedStatus),
    refetchInterval: 15000,
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['routes'],
    queryFn: () => apiClient.getRoutes(),
  });

  const currentRoute: BusRoute | undefined = routes.find(
    (r) => r.id === activeTrip?.route_id || r.destination === activeTrip?.destination
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0B1F33] tracking-tight">
            Demand Trips &amp; Lifecycle
          </h1>
          <p className="text-xs text-[#5A6E82]">
            End-to-end trip states: Aggregating &rarr; Threshold Met &rarr; Scheduled &rarr;
            Boarding &rarr; Departed &rarr; Completed
          </p>
        </div>
        <StaleIndicator
          dataUpdatedAt={dataUpdatedAt}
          isFetching={isFetching}
          onRefresh={() => refetch()}
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#E2E8F0]">
        <Filter className="w-3.5 h-3.5 text-[#5A6E82] ml-1 mr-2 flex-shrink-0" />
        {STATUS_FILTERS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setSelectedStatus(tab.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedStatus === tab.value
                ? 'bg-[#0B1F33] text-white shadow-sm'
                : 'text-[#5A6E82] hover:bg-gray-100 hover:text-[#0B1F33]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Trips Table */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-[#5A6E82]">Loading trips...</div>
      ) : trips.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="w-6 h-6 text-[#5A6E82]" />}
          title="No Trips Found"
          description={`There are currently no trips matching status filter "${selectedStatus}".`}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-[#D5DFE9] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#5A6E82] uppercase text-[10px] tracking-wider border-b border-[#E2E8F0]">
                <tr>
                  <th className="py-3 px-4 font-bold">Route / Destination</th>
                  <th className="py-3 px-4 font-bold">Train &amp; Date</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold">Passenger Progress</th>
                  <th className="py-3 px-4 font-bold">Bus / Crew</th>
                  <th className="py-3 px-4 font-bold text-right">Route Map</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {trips.map((trip) => (
                  <tr key={trip.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#0B1F33]">
                        {trip.destination || trip.route_name || 'Mysuru Destination'}
                      </div>
                      <div className="text-[10px] text-[#5A6E82]">
                        Origin: {trip.origin || 'Mysuru Jn (MYS)'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#0B1F33]">Train #{trip.train_number}</div>
                      <div className="text-[10px] text-[#5A6E82]">{trip.travel_date}</div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge status={trip.status} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              trip.confirmed_bookings_count >= trip.target_threshold
                                ? 'bg-green-600'
                                : 'bg-[#F5A524]'
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                (trip.confirmed_bookings_count / (trip.target_threshold || 20)) *
                                  100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="font-bold text-[11px] text-[#0B1F33]">
                          {trip.confirmed_bookings_count}/{trip.target_threshold}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#5A6E82] mt-0.5">
                        {trip.seats_remaining} seats remaining
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-[11px] font-semibold text-[#0B1F33]">
                        {trip.bus_registration || (
                          <span className="text-[#A0B0C0] font-normal italic">Unassigned</span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#5A6E82]">
                        {trip.conductor_name || (
                          <span className="text-[#A0B0C0] italic">No conductor</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setActiveTrip(trip)}
                        className="px-2.5 py-1 bg-blue-50 text-[#0066CC] hover:bg-blue-100 font-bold rounded-lg text-[11px] inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Stops</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Route & Stop Details Modal */}
      {activeTrip && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-base font-black text-[#0B1F33]">
                  Trip Stop Route &amp; Verification
                </h3>
                <p className="text-xs text-[#5A6E82]">
                  Train #{activeTrip.train_number} &rarr; {activeTrip.destination} (
                  {activeTrip.travel_date})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTrip(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-[#5A6E82]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <RouteMap
              stops={currentRoute?.stops || []}
              routeName={currentRoute?.name || activeTrip.destination}
              origin={activeTrip.origin || 'Mysuru Junction (MYS)'}
              destination={activeTrip.destination}
            />

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveTrip(null)}
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
