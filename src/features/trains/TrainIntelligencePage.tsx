import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Train, Sparkles, MapPin } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { StaleIndicator } from '../../components/ui/StaleIndicator';
import { EmptyState } from '../../components/ui/EmptyState';

export const TrainIntelligencePage: React.FC = () => {
  const {
    data: intelligence,
    isLoading,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ['train-intelligence'],
    queryFn: () => apiClient.getTrainIntelligence(),
    refetchInterval: 15000,
  });

  const integrationState = intelligence?.integration_state || 'SYNTHETIC_DATA';
  const trains = intelligence?.trains || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0B1F33] tracking-tight">
            Train Intelligence &amp; Feeder Forecasts
          </h1>
          <p className="text-xs text-[#5A6E82]">
            Inbound train arrival predictions and correlated bus feeder dispatch schedules
          </p>
        </div>
        <StaleIndicator
          dataUpdatedAt={dataUpdatedAt}
          isFetching={isFetching}
          onRefresh={() => refetch()}
        />
      </div>

      {/* Integration Banner */}
      <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F5A524] text-[#0B1F33] flex items-center justify-center font-bold">
            <Train className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#0B1F33]">Railway Telemetry Status:</span>
              <span
                data-testid="train-integration-state"
                className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-200 text-amber-900 border border-amber-400"
              >
                {integrationState}
              </span>
            </div>
            <p className="text-[11px] text-[#7A5800] mt-0.5">
              Predictions below are generated from historical delay models. CRIS live API is not
              connected.
            </p>
          </div>
        </div>
      </div>

      {/* Train Prediction Cards */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-[#5A6E82]">Loading predictions...</div>
      ) : trains.length === 0 ? (
        <EmptyState
          icon={<Train className="w-6 h-6 text-[#5A6E82]" />}
          title="No Inbound Trains Monitored"
          description="No train schedules active for today's feeder window."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {trains.map((train) => {
            const isDelayed = (train.delay_minutes || 0) > 0;

            return (
              <div
                key={train.train_number}
                className="bg-white rounded-2xl border border-[#D5DFE9] p-5 shadow-sm space-y-4 hover:border-[#0066CC]/50 transition-all flex flex-col justify-between"
              >
                {/* Visible Badge on EVERY prediction card */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#0066CC]">
                    Train #{train.train_number}
                  </span>
                  <span
                    data-testid="synthetic-badge"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide uppercase bg-amber-100 text-amber-900 border border-amber-300"
                  >
                    <Sparkles className="w-3 h-3 text-amber-700" />
                    <span>{train.is_synthetic ? 'SYNTHETIC DATA' : 'LIVE TELEMETRY'}</span>
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-black text-[#0B1F33]">{train.train_name}</h3>
                  <div className="text-xs text-[#5A6E82] flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    <span>
                      {train.origin} &rarr; {train.destination}
                    </span>
                  </div>
                </div>

                {/* Timing & Delay Grid */}
                <div className="grid grid-cols-2 gap-2 bg-[#F8FAFC] p-3 rounded-xl border border-gray-100 text-xs">
                  <div>
                    <span className="text-[10px] text-[#5A6E82] uppercase font-bold block">
                      Scheduled
                    </span>
                    <span className="font-bold text-[#0B1F33]">{train.scheduled_arrival}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-[#5A6E82] uppercase font-bold block">
                      Forecast Arrival
                    </span>
                    <span
                      className={`font-bold ${isDelayed ? 'text-amber-700' : 'text-green-700'}`}
                    >
                      {train.estimated_arrival} {isDelayed && `(+${train.delay_minutes}m)`}
                    </span>
                  </div>

                  <div className="mt-1">
                    <span className="text-[10px] text-[#5A6E82] uppercase font-bold block">
                      Platform
                    </span>
                    <span className="font-bold text-[#0B1F33]">{train.platform}</span>
                  </div>

                  <div className="mt-1">
                    <span className="text-[10px] text-[#5A6E82] uppercase font-bold block">
                      Feeder Status
                    </span>
                    <span className="font-bold text-[#0066CC]">
                      {train.feeder_demand_status || 'AGGREGATING'}
                    </span>
                  </div>
                </div>

                {/* AI / Synthetic Confidence Footnote */}
                <div className="text-[10px] text-[#5A6E82] flex items-center justify-between pt-2 border-t border-gray-100">
                  <span>
                    Confidence:{' '}
                    <strong>{Math.round((train.confidence_score || 0.95) * 100)}%</strong>
                  </span>
                  <span className="text-[#A0B0C0] font-mono">Simulated</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
