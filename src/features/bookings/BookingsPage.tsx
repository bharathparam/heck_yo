import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Search, CheckCircle2, Clock } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { StaleIndicator } from '../../components/ui/StaleIndicator';
import { EmptyState } from '../../components/ui/EmptyState';

export const BookingsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const {
    data: bookings = [],
    isLoading,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ['operator-bookings'],
    queryFn: () => apiClient.getBookings(500),
    refetchInterval: 15000,
  });

  const filteredBookings = bookings.filter((b) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      b.booking_reference?.toLowerCase().includes(q) ||
      b.passenger_name?.toLowerCase().includes(q) ||
      b.destination?.toLowerCase().includes(q) ||
      b.train_number?.toLowerCase().includes(q) ||
      b.id?.toLowerCase().includes(q)
    );
  });

  const totalPaidRevenue = bookings
    .filter((b) => b.payment_status === 'PAID')
    .reduce((sum, b) => sum + (b.total_fare || 0), 0);

  const totalPaidSeats = bookings
    .filter((b) => b.payment_status === 'PAID')
    .reduce((sum, b) => sum + (b.seats_count || 1), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0B1F33] tracking-tight">
            Bookings &amp; Passenger Manifests
          </h1>
          <p className="text-xs text-[#5A6E82]">
            Verified bookings, seat reservations, and transaction records
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
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Bookings</span>
            <CreditCard className="w-4 h-4 text-[#0066CC]" />
          </div>
          <div className="text-2xl font-black text-[#0B1F33]">{bookings.length}</div>
          <div className="text-[10px] text-[#5A6E82] mt-1">Confirmed transactions</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D5DFE9] shadow-sm">
          <div className="flex items-center justify-between text-[#5A6E82] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Paid Passenger Seats
            </span>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-black text-green-600">{totalPaidSeats}</div>
          <div className="text-[10px] text-[#5A6E82] mt-1">Across all demand groups</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D5DFE9] shadow-sm">
          <div className="flex items-center justify-between text-[#5A6E82] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Fare Value</span>
            <span className="text-xs font-bold text-emerald-600">INR</span>
          </div>
          <div className="text-2xl font-black text-emerald-600">
            ₹{totalPaidRevenue.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-[#5A6E82] mt-1">Direct settlement revenue</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-[#D5DFE9] shadow-sm flex items-center gap-2">
        <Search className="w-4 h-4 text-[#5A6E82] ml-2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by Booking Reference (e.g. RB-), passenger name, train #, or destination..."
          className="w-full text-xs text-[#0B1F33] placeholder-[#A0B0C0] focus:outline-none"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="text-[11px] font-bold text-[#5A6E82] hover:text-[#0B1F33] px-2 py-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Bookings Table */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-[#5A6E82]">Loading booking records...</div>
      ) : filteredBookings.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="w-6 h-6 text-[#5A6E82]" />}
          title="No Bookings Match Query"
          description={
            searchTerm
              ? `No bookings matched "${searchTerm}". Try searching by another reference code.`
              : 'No bookings recorded in the system yet.'
          }
        />
      ) : (
        <div className="bg-white rounded-2xl border border-[#D5DFE9] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#5A6E82] uppercase text-[10px] tracking-wider border-b border-[#E2E8F0]">
                <tr>
                  <th className="py-3 px-4 font-bold">Booking Reference</th>
                  <th className="py-3 px-4 font-bold">Passenger</th>
                  <th className="py-3 px-4 font-bold">Trip / Train</th>
                  <th className="py-3 px-4 font-bold">Seats</th>
                  <th className="py-3 px-4 font-bold">Fare Paid</th>
                  <th className="py-3 px-4 font-bold">Payment Status</th>
                  <th className="py-3 px-4 font-bold">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#0B1F33]">
                      {b.booking_reference || b.id.slice(0, 8)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#0B1F33]">
                        {b.passenger_name || 'Passenger'}
                      </div>
                      <div className="text-[10px] text-[#5A6E82]">
                        {b.passenger_phone || b.passenger_email || '—'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#0B1F33]">{b.destination}</div>
                      <div className="text-[10px] text-[#5A6E82]">
                        Train #{b.train_number || 'N/A'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold text-[#0B1F33]">
                      {b.seats_count || b.seat_count || 1} seat
                      {(b.seats_count || b.seat_count || 1) > 1 ? 's' : ''}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-700">₹{b.total_fare || 0}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          b.payment_status === 'PAID'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : b.payment_status === 'REFUNDED'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {b.payment_status === 'PAID' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Clock className="w-3 h-3 text-amber-600" />
                        )}
                        <span>{b.payment_status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#5A6E82] text-[11px]">
                      {new Date(b.created_at).toLocaleString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
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
