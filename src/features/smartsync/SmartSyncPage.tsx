import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Radio, AlertTriangle, Cpu, CheckCircle2, Clock } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { StaleIndicator } from '../../components/ui/StaleIndicator';

export const SmartSyncPage: React.FC = () => {
  const {
    data: smartSync,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ['smartsync-status'],
    queryFn: () => apiClient.getSmartSyncStatus(),
    refetchInterval: 15000,
  });

  const integrationState = smartSync?.integration_state || 'SYNTHETIC_DATA';
  const isSynthetic = smartSync?.is_synthetic ?? true;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0B1F33] tracking-tight">
            SmartSync Feeder Telemetry
          </h1>
          <p className="text-xs text-[#5A6E82]">
            Railway feed integration status and automated demand triggers
          </p>
        </div>
        <StaleIndicator
          dataUpdatedAt={dataUpdatedAt}
          isFetching={isFetching}
          onRefresh={() => refetch()}
        />
      </div>

      {/* Integration State Banner */}
      <div
        className={`p-5 rounded-2xl border shadow-sm ${
          integrationState === 'LIVE'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
            : integrationState === 'SYNTHETIC_DATA'
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-red-50 border-red-300 text-red-950'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${
                integrationState === 'LIVE'
                  ? 'bg-emerald-600 text-white'
                  : integrationState === 'SYNTHETIC_DATA'
                    ? 'bg-[#F5A524] text-[#0B1F33]'
                    : 'bg-red-600 text-white'
              }`}
            >
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#5A6E82]">
                  Rail Integration Engine
                </span>
                <span
                  data-testid="integration-state-badge"
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    integrationState === 'LIVE'
                      ? 'bg-emerald-200 text-emerald-900'
                      : integrationState === 'SYNTHETIC_DATA'
                        ? 'bg-amber-200 text-amber-900 ring-1 ring-amber-400'
                        : 'bg-red-200 text-red-900'
                  }`}
                >
                  {integrationState}
                </span>
              </div>
              <h2 className="text-base font-black mt-0.5">
                {integrationState === 'LIVE'
                  ? 'Connected to Live CRIS / IRCTC Feeds'
                  : integrationState === 'SYNTHETIC_DATA'
                    ? 'Synthetic Simulation Active'
                    : 'Feed Disconnected'}
              </h2>
            </div>
          </div>

          <div className="text-[11px] font-semibold text-[#5A6E82] sm:text-right">
            Last sync:{' '}
            {smartSync?.last_sync_at
              ? new Date(smartSync.last_sync_at).toLocaleTimeString()
              : 'Just now'}
          </div>
        </div>

        {/* Mandatory Transparency Notice */}
        {isSynthetic && (
          <div className="mt-4 pt-3 border-t border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Synthetic Railway Telemetry Disclaimer: </span>
              <span>
                {smartSync?.disclaimer ||
                  'Synthetic railway simulation for Mysuru Railway Station feeder planning. Real Indian Railways / CRIS telemetry is not connected. All train arrival predictions and delay models are synthetic estimates.'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Engine Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#D5DFE9] shadow-sm">
          <div className="flex items-center justify-between text-[#5A6E82] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Engine Protocol</span>
            <Cpu className="w-4 h-4 text-[#0066CC]" />
          </div>
          <div className="text-xl font-black text-[#0B1F33]">SmartSync v2.1</div>
          <div className="text-[10px] text-[#5A6E82] mt-1">Algorithmic bus synchronization</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D5DFE9] shadow-sm">
          <div className="flex items-center justify-between text-[#5A6E82] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Monitored Inbound
            </span>
            <Clock className="w-4 h-4 text-[#F5A524]" />
          </div>
          <div className="text-xl font-black text-[#0B1F33]">
            {smartSync?.trains?.length || 4} Trains
          </div>
          <div className="text-[10px] text-[#5A6E82] mt-1">Mysuru Jn incoming arrivals</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D5DFE9] shadow-sm">
          <div className="flex items-center justify-between text-[#5A6E82] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Sync State</span>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-xl font-black text-green-600">Active Polling</div>
          <div className="text-[10px] text-[#5A6E82] mt-1">15s telemetry interval</div>
        </div>
      </div>
    </div>
  );
};
