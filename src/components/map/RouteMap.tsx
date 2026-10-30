import React from 'react';
import { MapPin, AlertCircle, ExternalLink } from 'lucide-react';
import type { RouteStop } from '../../types';

interface RouteMapProps {
  stops: RouteStop[];
  routeName: string;
  origin?: string;
  destination?: string;
}

export const RouteMap: React.FC<RouteMapProps> = ({
  stops,
  routeName,
  origin = 'Mysuru Junction (Railway Station)',
  destination = 'Destination',
}) => {
  const geoStops = stops.filter(
    (s) =>
      typeof s.latitude === 'number' &&
      typeof s.longitude === 'number' &&
      s.latitude !== 0 &&
      s.longitude !== 0
  );

  const hasCoordinates = geoStops.length >= 2;

  return (
    <div className="bg-white rounded-2xl border border-[#D9E1EA] p-5 space-y-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <span className="font-mono text-xs font-bold text-[#F5A524] bg-[#0B1F33] px-2 py-0.5 rounded">
            {routeName}
          </span>
          <h3 className="font-bold text-base text-[#0B1F33] mt-1.5">
            {origin} &rarr; {destination}
          </h3>
          <p className="text-xs text-[#74777d]">{stops.length} ordered stops from route dataset</p>
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
            hasCoordinates
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-amber-50 text-amber-800 border-amber-300'
          }`}
        >
          {hasCoordinates ? `${geoStops.length} coordinates mapped` : 'No coordinates available'}
        </span>
      </div>

      {!hasCoordinates ? (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">
                No coordinates available in backend route record
              </span>
              <p className="text-[11px] leading-relaxed">
                Exact stop latitude/longitude coordinates are not stored for this route.
                Browser-side geocoding and external OSRM road queries are disabled. Displaying
                verified stop sequence below:
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#D9E1EA] bg-[#F3F6FA] p-3 max-h-56 overflow-y-auto space-y-2">
            <div className="text-[10px] font-bold text-[#74777d] uppercase tracking-wider">
              Ordered Stop Sequence
            </div>
            <ol className="space-y-1.5 text-xs">
              {stops.map((stop, idx) => (
                <li key={stop.id} className="flex items-center gap-2 text-[#0B1F33]">
                  <span className="w-5 h-5 rounded-full bg-white border border-[#D9E1EA] text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span>{stop.stop_name}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="pt-1">
            <a
              href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(`${origin} to ${destination}, Mysuru`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1F33] hover:underline"
            >
              <span>View route area on OpenStreetMap</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Simple clean visual representation of backend coordinates */}
          <div className="relative w-full h-48 bg-[#F3F6FA] rounded-xl border border-[#D9E1EA] overflow-hidden flex items-center justify-center p-4">
            <div className="w-full flex items-center justify-between relative z-10 px-6">
              {geoStops.slice(0, 5).map((stop) => (
                <div key={stop.id} className="flex flex-col items-center text-center space-y-1">
                  <div className="w-8 h-8 rounded-full bg-[#0B1F33] text-white flex items-center justify-center shadow-md border-2 border-white">
                    <MapPin className="w-4 h-4 text-[#F5A524]" />
                  </div>
                  <span className="text-[10px] font-bold text-[#0B1F33] max-w-[80px] truncate">
                    {stop.stop_name}
                  </span>
                  <span className="text-[9px] text-[#74777d] font-mono">
                    {stop.latitude?.toFixed(3)}, {stop.longitude?.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
            {/* Connecting line */}
            <div className="absolute left-10 right-10 h-0.5 bg-[#0B7A55]/40" />
          </div>

          <div className="rounded-xl border border-[#D9E1EA] bg-white p-3 max-h-48 overflow-y-auto space-y-1.5 text-xs">
            {stops.map((stop, idx) => {
              const hasPoint =
                typeof stop.latitude === 'number' && typeof stop.longitude === 'number';
              return (
                <div
                  key={stop.id}
                  className="flex items-center justify-between py-1 border-b border-[#F3F6FA] last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#F3F6FA] text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-[#0B1F33]">{stop.stop_name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#74777d]">
                    {hasPoint
                      ? `${stop.latitude?.toFixed(4)}, ${stop.longitude?.toFixed(4)}`
                      : 'No coords'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
