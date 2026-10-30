import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Send, Users, Bus as BusIcon, AlertTriangle, ArrowRight, TrendingUp } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { Badge } from '../../components/ui/Badge';
import { StaleIndicator } from '../../components/ui/StaleIndicator';
import { Notice } from '../../components/ui/Notice';

export const OverviewPage: React.FC = () => {
  const {
    data: trips = [],
    isLoading: tripsLoading,
    isError: tripsError,
    error: tripsErr,
    dataUpdatedAt,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['trips', 'overview'],
    queryFn: () => apiClient.getTrips(),
    refetchInterval: 15000,
  });

  const { data: buses = [] } = useQuery({
    queryKey: ['buses'],
    queryFn: () => apiClient.getBuses(),
    refetchInterval: 30000,
  });

  const { data: conductors = [] } = useQuery({
    queryKey: ['conductors'],
    queryFn: () => apiClient.getConductors(),
    refetchInterval: 30000,
  });

  const aggregating = trips.filter((t) => t.status === 'AGGREGATING');
  const thresholdMet = trips.filter(
    (t) => t.status === 'THRESHOLD_MET' || t.status === 'READY_TO_DISPATCH'
  );
  const scheduled = trips.filter(
    (t) => t.status === 'SCHEDULED' || t.status === 'DISPATCHED' || t.status === 'BOARDING'
  );

  const totalSeatsConfirmed = trips.reduce((acc, t) => acc + (t.confirmed_bookings_count || 0), 0);
  const availableBuses = buses.filter((b) => b.status === 'AVAILABLE');
  const availableConductors = conductors.filter((c) => c.status === 'AVAILABLE');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0B1F33] tracking-tight">
            Network Operations Overview
          </h1>
          <p className="text-xs text-[#5A6E82]">
            Real-time Mysore rail-to-bus coordination and demand aggregation
          </p>
        </div>
        <StaleIndicator
          dataUpdatedAt={dataUpdatedAt}
          isFetching={isFetching}
          onRefresh={() => refetch()}
        />
      </div>

      {tripsError && (
        <Notice
          type="error"
          message={tripsErr instanceof Error ? tripsErr.message : 'Backend unreachable'}
        />
      )}

      {/* Threshold Alert Banner if trips ready for dispatch */}
      {thresholdMet.length > 0 && (
        <div className="bg-[#FFF8E6] border border-[#F5A524] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F5A524] text-[#0B1F33] flex items-center justify-center font-black">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#0B1F33]">
                {thresholdMet.length} Trip{thresholdMet.length > 1 ? 's' : ''} Ready for Dispatch
              </div>
              <div className="text-[11px] text-[#7A5800]">
                Threshold reached. Assign bus and conductor in the Dispatch Centre.
              </div>
            </div>
          </div>
          <Link
            to="/dispatch"
            className="px-4 py-2 bg-[#0B1F33] text-white hover:bg-[#152B3E] rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
          >
            <span>Open Dispatch Centre</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#F5A524]" />
          </Link>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#D5DFE9] shadow-sm">
          <div className="flex items-center justify-between text-[#5A6E82] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Demand Aggregating
            </span>
            <TrendingUp className="w-4 h-4 text-[#F5A524]" />
          </div>
          <div className="text-2xl font-black text-[#0B1F33]">{aggregating.length}</div>
          <div className="text-[10px] text-[#5A6E82] mt-1">Collecting passenger demand</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D5DFE9] shadow-sm">
          <div className="flex items-center justify-between text-[#5A6E82] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Threshold Met</span>
            <AlertTriangle className="w-4 h-4 text-[#0066CC]" />
          </div>
          <div className="text-2xl font-black text-[#0066CC]">{thresholdMet.length}</div>
          <div className="text-[10px] text-[#5A6E82] mt-1">Awaiting bus/crew assignment</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D5DFE9] shadow-sm">
          <div className="flex items-center justify-between text-[#5A6E82] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Scheduled</span>
            <BusIcon className="w-4 h-4 text-[#00875A]" />
          </div>
          <div className="text-2xl font-black text-[#00875A]">{scheduled.length}</div>
          <div className="text-[10px] text-[#5A6E82] mt-1">Boarding or in transit</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D5DFE9] shadow-sm">
          <div className="flex items-center justify-between text-[#5A6E82] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Confirmed Seats</span>
            <Users className="w-4 h-4 text-[#7C3AED]" />
          </div>
          <div className="text-2xl font-black text-[#7C3AED]">{totalSeatsConfirmed}</div>
          <div className="text-[10px] text-[#5A6E82] mt-1">Total paid bookings</div>
        </div>
      </div>

      {/* Fleet & Crew Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#D5DFE9] shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <BusIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#0B1F33]">KSRTC Bus Availability</div>
              <div className="text-[11px] text-[#5A6E82]">
                {availableBuses.length} of {buses.length} buses currently ready for dispatch
              </div>
            </div>
          </div>
          <Link to="/fleet" className="text-xs font-bold text-[#0066CC] hover:underline">
            Manage &rarr;
          </Link>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D5DFE9] shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#0B1F33]">Conductor Roster</div>
              <div className="text-[11px] text-[#5A6E82]">
                {availableConductors.length} of {conductors.length} crew available
              </div>
            </div>
          </div>
          <Link to="/conductors" className="text-xs font-bold text-[#0066CC] hover:underline">
            Manage &rarr;
          </Link>
        </div>
      </div>

      {/* Recent Trips Table */}
      <div className="bg-white rounded-2xl border border-[#D5DFE9] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#0B1F33]">Live Demand &amp; Dispatch Queue</h2>
            <p className="text-[11px] text-[#5A6E82]">Real-time status of passenger trips</p>
          </div>
          <Link to="/trips" className="text-xs font-bold text-[#0066CC] hover:underline">
            View All ({trips.length}) &rarr;
          </Link>
        </div>

        {tripsLoading ? (
          <div className="p-8 text-center text-xs text-[#5A6E82]">Loading network trips...</div>
        ) : trips.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#5A6E82]">No active trips found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#5A6E82] uppercase text-[10px] tracking-wider border-b border-[#E2E8F0]">
                <tr>
                  <th className="py-2.5 px-4 font-bold">Route / Destination</th>
                  <th className="py-2.5 px-4 font-bold">Train &amp; Date</th>
                  <th className="py-2.5 px-4 font-bold">Demand / Threshold</th>
                  <th className="py-2.5 px-4 font-bold">Status</th>
                  <th className="py-2.5 px-4 font-bold">Vehicle / Crew</th>
                  <th className="py-2.5 px-4 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {trips.slice(0, 6).map((trip) => (
                  <tr key={trip.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#0B1F33]">
                        {trip.destination || trip.route_name || 'Mysuru Route'}
                      </div>
                      <div className="text-[10px] text-[#5A6E82]">
                        From: {trip.origin || 'Mysuru Junction (MYS)'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#0B1F33]">Train #{trip.train_number}</div>
                      <div className="text-[10px] text-[#5A6E82]">{trip.travel_date}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              (trip.confirmed_bookings_count || 0) >= (trip.target_threshold || 20)
                                ? 'bg-green-600'
                                : 'bg-[#F5A524]'
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                ((trip.confirmed_bookings_count || 0) /
                                  (trip.target_threshold || 20)) *
                                  100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="font-bold text-[11px] text-[#0B1F33]">
                          {trip.confirmed_bookings_count}/{trip.target_threshold}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge status={trip.status} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-[11px] text-[#0B1F33]">
                        {trip.bus_registration || (
                          <span className="text-[#A0B0C0] italic">Unassigned</span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#5A6E82]">
                        {trip.conductor_name || (
                          <span className="text-[#A0B0C0] italic">No conductor</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {trip.status === 'THRESHOLD_MET' || trip.status === 'READY_TO_DISPATCH' ? (
                        <Link
                          to="/dispatch"
                          className="px-2.5 py-1 bg-[#F5A524] text-[#0B1F33] font-bold rounded-lg text-[11px] hover:bg-[#e0941d] inline-flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          <span>Assign</span>
                        </Link>
                      ) : (
                        <Link
                          to="/trips"
                          className="px-2.5 py-1 bg-gray-100 text-[#0B1F33] font-semibold rounded-lg text-[11px] hover:bg-gray-200"
                        >
                          Details
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
