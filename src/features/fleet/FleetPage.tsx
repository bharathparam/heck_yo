import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bus as BusIcon, Activity, CheckCircle2, Wrench } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { StaleIndicator } from '../../components/ui/StaleIndicator';
import { EmptyState } from '../../components/ui/EmptyState';

export const FleetPage: React.FC = () => {
  const {
    data: buses = [],
    isLoading,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ['buses'],
    queryFn: () => apiClient.getBuses(),
    refetchInterval: 15000,
  });

  const total = buses.length;
  const available = buses.filter((b) => b.status === 'AVAILABLE').length;
  const assigned = buses.filter((b) => b.status === 'ASSIGNED').length;
  const utilizationRate = total > 0 ? Math.round((assigned / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0B1F33] tracking-tight">
            Fleet Utilisation &amp; Assets
          </h1>
          <p className="text-xs text-[#5A6E82]">
            KSRTC bus fleet allocation, active transit assignments, and maintenance readiness
          </p>
        </div>
        <StaleIndicator
          dataUpdatedAt={dataUpdatedAt}
          isFetching={isFetching}
          onRefresh={() => refetch()}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#D5DFE9] shadow-sm">
          <div className="flex items-center justify-between text-[#5A6E82] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Fleet</span>
            <BusIcon className="w-4 h-4 text-[#0066CC]" />
          </div>
          <div className="text-2xl font-black text-[#0B1F33]">{total}</div>
          <div className="text-[10px] text-[#5A6E82] mt-1">Configured KSRTC buses</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D5DFE9] shadow-sm">
          <div className="flex items-center justify-between text-[#5A6E82] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">In Service</span>
            <Activity className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">{assigned}</div>
          <div className="text-[10px] text-[#5A6E82] mt-1">Assigned to active trips</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D5DFE9] shadow-sm">
          <div className="flex items-center justify-between text-[#5A6E82] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Available Standby
            </span>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-black text-green-600">{available}</div>
          <div className="text-[10px] text-[#5A6E82] mt-1">Ready for immediate dispatch</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D5DFE9] shadow-sm">
          <div className="flex items-center justify-between text-[#5A6E82] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Fleet Utilisation
            </span>
            <span className="text-xs font-black text-[#0066CC]">{utilizationRate}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="bg-[#0066CC] h-full rounded-full transition-all duration-500"
              style={{ width: `${utilizationRate}%` }}
            />
          </div>
          <div className="text-[10px] text-[#5A6E82] mt-2">Active deployment percentage</div>
        </div>
      </div>

      {/* Fleet Table */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-[#5A6E82]">Loading fleet assets...</div>
      ) : buses.length === 0 ? (
        <EmptyState
          icon={<BusIcon className="w-6 h-6 text-[#5A6E82]" />}
          title="No Buses Found"
          description="No fleet assets are currently registered in the database."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-[#D5DFE9] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#5A6E82] uppercase text-[10px] tracking-wider border-b border-[#E2E8F0]">
                <tr>
                  <th className="py-3 px-4 font-bold">Vehicle Registration</th>
                  <th className="py-3 px-4 font-bold">Bus Model &amp; Type</th>
                  <th className="py-3 px-4 font-bold">Seating Capacity</th>
                  <th className="py-3 px-4 font-bold">Operating Status</th>
                  <th className="py-3 px-4 font-bold">Current Assigned Trip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {buses.map((bus) => (
                  <tr key={bus.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#0B1F33] flex items-center gap-2">
                        <BusIcon className="w-4 h-4 text-[#0066CC]" />
                        <span>{bus.registration_number}</span>
                      </div>
                      <div className="text-[10px] text-[#5A6E82]">ID: {bus.id}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-[#0B1F33]">{bus.model}</td>
                    <td className="py-3 px-4 font-bold text-[#0B1F33]">{bus.capacity} seats</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          bus.status === 'AVAILABLE'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : bus.status === 'ASSIGNED'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-red-50 text-red-800 border-red-200'
                        }`}
                      >
                        {bus.status === 'AVAILABLE' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : bus.status === 'ASSIGNED' ? (
                          <Activity className="w-3 h-3 text-amber-600" />
                        ) : (
                          <Wrench className="w-3 h-3 text-red-600" />
                        )}
                        <span>{bus.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#5A6E82]">
                      {bus.current_trip_id ? (
                        <span className="font-bold text-[#0066CC]">
                          {bus.current_trip_id.slice(0, 12)}...
                        </span>
                      ) : (
                        <span className="italic text-[#A0B0C0]">None (Available)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
