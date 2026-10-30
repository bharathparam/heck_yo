import React from 'react';
import { RefreshCw } from 'lucide-react';

interface StaleIndicatorProps {
  isFetching: boolean;
  dataUpdatedAt?: number;
  onRefresh?: () => void;
}

export const StaleIndicator: React.FC<StaleIndicatorProps> = ({
  isFetching,
  dataUpdatedAt,
  onRefresh,
}) => {
  const timeString = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  return (
    <div className="inline-flex items-center gap-2 text-xs text-[#74777d] bg-white border border-[#D9E1EA] px-2.5 py-1 rounded-lg">
      <span
        className={`w-2 h-2 rounded-full ${isFetching ? 'bg-[#F5A524] animate-ping' : 'bg-[#0B7A55]'}`}
      />
      <span>{isFetching ? 'Updating…' : `Updated ${timeString}`}</span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="hover:text-[#0B1F33] active:scale-95 transition-transform"
          title="Refresh data"
          type="button"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>
  );
};
