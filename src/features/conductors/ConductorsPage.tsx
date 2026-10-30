import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, UserCheck, Phone, Mail, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { StaleIndicator } from '../../components/ui/StaleIndicator';
import { EmptyState } from '../../components/ui/EmptyState';

export const ConductorsPage: React.FC = () => {
  const {
    data: conductors = [],
    isLoading,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ['conductors'],
    queryFn: () => apiClient.getConductors(),
    refetchInterval: 15000,
  });

  const total = conductors.length;
  const available = conductors.filter((c) => c.status === 'AVAILABLE').length;
  const assigned = conductors.filter((c) => c.status === 'ASSIGNED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0B1F33] tracking-tight">
            Crew &amp; Conductors Roster
          </h1>
          <p className="text-xs text-[#5A6E82]">
            Conductor duty status, real-time trip assignments, and contact channels
          </p>
        </div>
        <StaleIndicator
          dataUpdatedAt={dataUpdatedAt}
          isFetching={isFetching}
          onRefresh={() => refetch()}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#D5DFE9] shadow-sm">
          <div className="flex items-center justify-between text-[#5A6E82] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Crew</span>
            <Users className="w-4 h-4 text-[#0066CC]" />
          </div>
          <div className="text-2xl font-black text-[#0B1F33]">{total}</div>
          <div className="text-[10px] text-[#5A6E82] mt-1">Registered conductors</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D5DFE9] shadow-sm">
          <div className="flex items-center justify-between text-[#5A6E82] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Available on Standby
            </span>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-black text-green-600">{available}</div>
          <div className="text-[10px] text-[#5A6E82] mt-1">Ready for route dispatch</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D5DFE9] shadow-sm">
          <div className="flex items-center justify-between text-[#5A6E82] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active On Duty</span>
            <UserCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">{assigned}</div>
          <div className="text-[10px] text-[#5A6E82] mt-1">Assigned to in-transit service</div>
        </div>
      </div>

      {/* Conductors Table */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-[#5A6E82]">Loading conductor roster...</div>
      ) : conductors.length === 0 ? (
        <EmptyState
          icon={<Users className="w-6 h-6 text-[#5A6E82]" />}
          title="No Conductors Found"
          description="No crew members are currently registered."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-[#D5DFE9] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#5A6E82] uppercase text-[10px] tracking-wider border-b border-[#E2E8F0]">
                <tr>
                  <th className="py-3 px-4 font-bold">Conductor Name</th>
                  <th className="py-3 px-4 font-bold">Phone Number</th>
                  <th className="py-3 px-4 font-bold">Email</th>
                  <th className="py-3 px-4 font-bold">Availability Status</th>
                  <th className="py-3 px-4 font-bold">Current Assignment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {conductors.map((conductor) => (
                  <tr key={conductor.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#0B1F33] flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-[#F5A524]" />
                        <span>{conductor.full_name}</span>
                      </div>
                      <div className="text-[10px] text-[#5A6E82]">ID: {conductor.id}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-[#0B1F33]">
                        <Phone className="w-3 h-3 text-[#5A6E82]" />
                        <span>{conductor.phone || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-[#5A6E82]">
                        <Mail className="w-3 h-3" />
                        <span>{conductor.email}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          conductor.status === 'AVAILABLE'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            conductor.status === 'AVAILABLE' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                        <span>{conductor.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#5A6E82]">
                      {conductor.current_trip_id ? (
                        <span className="font-bold text-[#0066CC]">
                          {conductor.current_trip_id.slice(0, 12)}...
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
