import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Filter, Clock, User, Tag } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { StaleIndicator } from '../../components/ui/StaleIndicator';
import { EmptyState } from '../../components/ui/EmptyState';

export const AuditPage: React.FC = () => {
  const [filterType, setFilterType] = useState<string>('ALL');

  const {
    data: events = [],
    isLoading,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ['audit-events'],
    queryFn: () => apiClient.getAuditEvents(200),
    refetchInterval: 15000,
  });

  const eventTypes = Array.from(new Set(events.map((e) => e.event_type))).filter(Boolean);

  const filteredEvents = events.filter((e) => {
    if (filterType === 'ALL') return true;
    return e.event_type === filterType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0B1F33] tracking-tight">
            Security &amp; Operations Audit Log
          </h1>
          <p className="text-xs text-[#5A6E82]">
            Immutable event history for dispatch actions, payments, and system state transitions
          </p>
        </div>
        <StaleIndicator
          dataUpdatedAt={dataUpdatedAt}
          isFetching={isFetching}
          onRefresh={() => refetch()}
        />
      </div>

      {/* Filter Chips */}
      {eventTypes.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#E2E8F0]">
          <Filter className="w-3.5 h-3.5 text-[#5A6E82] ml-1 mr-2 flex-shrink-0" />
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              filterType === 'ALL'
                ? 'bg-[#0B1F33] text-white shadow-sm'
                : 'text-[#5A6E82] hover:bg-gray-100 hover:text-[#0B1F33]'
            }`}
          >
            All Events ({events.length})
          </button>
          {eventTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterType === type
                  ? 'bg-[#0B1F33] text-white shadow-sm'
                  : 'text-[#5A6E82] hover:bg-gray-100 hover:text-[#0B1F33]'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      )}

      {/* Events Table */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-[#5A6E82]">Loading audit records...</div>
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          icon={<History className="w-6 h-6 text-[#5A6E82]" />}
          title="No Audit Records"
          description="No operations events have been logged yet."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-[#D5DFE9] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#5A6E82] uppercase text-[10px] tracking-wider border-b border-[#E2E8F0]">
                <tr>
                  <th className="py-3 px-4 font-bold">Event Type</th>
                  <th className="py-3 px-4 font-bold">Entity</th>
                  <th className="py-3 px-4 font-bold">Actor</th>
                  <th className="py-3 px-4 font-bold">Details</th>
                  <th className="py-3 px-4 font-bold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredEvents.map((evt) => {
                  let formattedDetails = '';
                  if (typeof evt.details === 'string') {
                    formattedDetails = evt.details;
                  } else if (evt.details) {
                    formattedDetails = JSON.stringify(evt.details);
                  }

                  return (
                    <tr key={evt.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-[#0B1F33] bg-gray-100 px-2 py-0.5 rounded">
                          <Tag className="w-3 h-3 text-[#5A6E82]" />
                          <span>{evt.event_type}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#0B1F33]">
                          {evt.entity_type || 'System'}
                        </div>
                        <div className="text-[10px] font-mono text-[#5A6E82]">
                          {evt.entity_id ? `${evt.entity_id.slice(0, 10)}...` : '—'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-[#0B1F33]">
                          <User className="w-3 h-3 text-[#5A6E82]" />
                          <span className="font-medium text-[11px]">
                            {evt.actor_id ? evt.actor_id.slice(0, 10) : 'System Worker'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#5A6E82] max-w-xs truncate">
                        {formattedDetails || '—'}
                      </td>
                      <td className="py-3 px-4 text-[#5A6E82] text-[11px] whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#A0B0C0]" />
                          <span>
                            {new Date(evt.created_at).toLocaleString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
