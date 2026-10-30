import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { AlertCircle, ArrowRight, Bus, Clock, Info, Loader2, MapPin, Search, Train } from 'lucide-react';
import { api } from '../services/api';
import type { ServiceOption } from '../types';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const POPULAR_DESTINATIONS = [
  'Kuvempunagar',
  'Vijayanagar',
  'Infosys',
  'Gokulam',
  'Chamundi Hill',
  'Suburban Bus Stand',
  'Saraswathipuram',
  'Hebbal',
  'Jayalakshmipuram',
  'Metagalli',
  'Bogadi',
];

export const TripRegistrationScreen: React.FC = () => {
  const navigate = useNavigate();
  const { t, activeBookingFlow, updateBookingFlow, dataError } = useApp();
  const [destination, setDestination] = useState(activeBookingFlow.destinationStopId ? '' : 'Kuvempunagar');
  const [trainNumber, setTrainNumber] = useState('12614');
  const [travelDate, setTravelDate] = useState(today());
  const [results, setResults] = useState<ServiceOption[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selecting, setSelecting] = useState('');

  const search = async (silent = false) => {
    if (!destination.trim() || !trainNumber.trim() || !travelDate) return;
    if (!silent) {
      setBusy(true);
      setError('');
    }
    try {
      const items = await api.searchTrips(destination.trim(), trainNumber.trim(), travelDate);
      setResults(items);
      setSearched(true);
      if (!silent && items.length === 0) {
        setError(`No direct feeder route found for "${destination}". Try Kuvempunagar, Vijayanagar, Infosys, or Suburban Bus Stand.`);
      }
    } catch (cause) {
      if (!silent) {
        setError(cause instanceof Error ? cause.message : 'Could not search available feeder routes.');
      }
    } finally {
      if (!silent) setBusy(false);
    }
  };

  useEffect(() => {
    if (!searched) return;
    const timer = window.setInterval(() => {
      void search(true);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [searched, destination, trainNumber, travelDate]);

  const selectService = async (option: ServiceOption) => {
    if (option.seats_remaining < 1 || !['AVAILABLE', 'AGGREGATING', 'THRESHOLD_MET'].includes(option.status)) return;
    setSelecting(option.route.id);
    setError('');
    try {
      const trip = await api.resolveTrip(
        option.route.id,
        option.destination_stop.id,
        trainNumber.trim(),
        travelDate
      );
      updateBookingFlow({
        destinationStopId: option.destination_stop.id,
        selectedTripId: trip.id,
        boardingStop: 'Mysuru Junction (Railway Station)',
        seatCount: 1,
      });
      navigate('/book/seats', {
        state: {
          trip,
          destinationStop: option.destination_stop,
          destinationStopId: option.destination_stop.id,
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That service is no longer open for booking. Search again.');
      await search(true);
    } finally {
      setSelecting('');
    }
  };

  const formatDeadlineCountdown = (deadlineIso?: string | null) => {
    if (!deadlineIso) return null;
    const diffMs = new Date(deadlineIso).getTime() - Date.now();
    if (diffMs <= 0) return 'Demand closed';
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${mins}m left to meet threshold`;
  };

  return (
    <div className="flex flex-col w-full max-w-md mx-auto space-y-4 pb-24 pt-20 px-4">
      <div className="space-y-1">
        <h1 className="font-bold text-2xl text-[#0B1F33] tracking-tight">{t.registration.title}</h1>
        <p className="text-sm text-[#74777d]">Search feeder buses connected to your arriving train at Mysuru Junction.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setResults([]);
          setSearched(false);
          void search();
        }}
        className="bg-white rounded-2xl p-5 border border-[#D9E1EA] shadow-sm space-y-4"
      >
        <div className="rounded-xl bg-[#F3F6FA] border border-[#D9E1EA] p-3 flex items-center gap-3">
          <Train className="w-5 h-5 text-[#0B1F33]" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#74777d]">Boarding origin · fixed</div>
            <div className="text-sm font-semibold">Mysuru Junction (Railway Station)</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="train-number" className="block text-xs font-bold uppercase tracking-wider">
            Train number
          </label>
          <input
            id="train-number"
            required
            value={trainNumber}
            onChange={(e) => setTrainNumber(e.target.value)}
            placeholder="e.g., 12614, 16216, 12007"
            maxLength={30}
            className="w-full h-[52px] rounded-xl border border-[#D9E1EA] px-3.5 text-sm font-medium"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="travel-date" className="block text-xs font-bold uppercase tracking-wider">
            Arrival / travel date
          </label>
          <input
            id="travel-date"
            type="date"
            min={today()}
            required
            value={travelDate}
            onChange={(e) => setTravelDate(e.target.value)}
            className="w-full h-[52px] rounded-xl border border-[#D9E1EA] px-3.5 text-sm font-medium"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="destination-input" className="block text-xs font-bold uppercase tracking-wider">
            Destination in Mysuru
          </label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-[#74777d] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="destination-input"
              required
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g., Kuvempunagar, Vijayanagar, Infosys"
              className="w-full h-[52px] rounded-xl border border-[#D9E1EA] pl-10 pr-3.5 text-sm font-medium"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {POPULAR_DESTINATIONS.slice(0, 5).map((dest) => (
              <button
                key={dest}
                type="button"
                onClick={() => setDestination(dest)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  destination.toLowerCase() === dest.toLowerCase()
                    ? 'bg-[#0B1F33] text-white border-[#0B1F33]'
                    : 'bg-[#F3F6FA] text-[#44474c] border-[#D9E1EA] hover:border-[#0B1F33]'
                }`}
              >
                {dest}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || !destination.trim()}
          className="w-full h-[52px] rounded-xl font-bold text-base flex items-center justify-center gap-2 bg-[#F5A524] text-[#0B1F33] disabled:opacity-50 active:scale-[0.99] transition-all cursor-pointer shadow-sm"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching available services…
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Search feeder buses
            </>
          )}
        </button>

        {(error || dataError) && (
          <div role="alert" className="p-3 rounded-xl bg-[#FDE8E8] text-xs font-semibold text-[#D32F2F] flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error || dataError}</span>
          </div>
        )}
      </form>

      {searched && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg text-[#0B1F33]">Available feeder routes</h2>
            <span className="text-[10px] text-[#74777d]">Updates in real-time</span>
          </div>

          {!results.length ? (
            <div className="bg-white rounded-2xl p-6 border border-[#D9E1EA] text-center text-sm text-[#74777d] space-y-2">
              <p>No matching feeder route found for &quot;{destination}&quot; on {travelDate}.</p>
              <p className="text-xs">Try selecting a major stop like Kuvempunagar, Vijayanagar, or Infosys.</p>
            </div>
          ) : (
            results.map((option) => {
              const full = option.seats_remaining === 0;
              const countdown = formatDeadlineCountdown(option.deadline_at);
              const progressPct = Math.min(100, (option.confirmed_seats / option.target_threshold) * 100);

              return (
                <article
                  key={`${option.route.id}-${option.destination_stop.id}`}
                  className="bg-white rounded-2xl p-4 border border-[#D9E1EA] shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#F5A524] bg-[#0B1F33] px-2 py-0.5 rounded">
                        {option.route.route_code}
                      </span>
                      <h3 className="font-bold text-base text-[#0B1F33] mt-1.5">
                        {option.destination_stop.stop_name}
                      </h3>
                      <p className="text-xs text-[#74777d]">
                        Train {option.train_number} · Travel Date: {option.travel_date}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xl font-bold text-[#0B1F33]">₹{option.fare_per_seat}</span>
                      <span className="block text-[10px] text-[#74777d]">fixed fare/seat</span>
                    </div>
                  </div>

                  {/* Demand progress bar & threshold */}
                  <div className="rounded-xl bg-[#F3F6FA] p-3 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <b className="flex items-center gap-1.5 text-[#0B1F33]">
                        <Bus className="w-3.5 h-3.5 text-[#0B7A55]" />
                        Demand: {option.confirmed_seats} / {option.target_threshold} confirmed seats
                      </b>
                      <span className="font-semibold text-xs text-[#0B7A55]">
                        {option.seats_remaining} seats remaining
                      </span>
                    </div>
                    <div className="h-2 bg-white rounded-full overflow-hidden border border-[#D9E1EA]">
                      <div
                        className="h-full bg-[#0B7A55] rounded-full transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    {countdown && (
                      <div className="flex items-center gap-1 text-[11px] text-[#B76E00] font-medium pt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{countdown}</span>
                      </div>
                    )}
                  </div>

                  {/* Refund on cancel guarantee notice */}
                  <div className="text-[11px] text-[#74777d] flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-[#0B1F33] shrink-0" />
                    <span>Automatic full refund if the 20-seat threshold is not reached.</span>
                  </div>

                  <button
                    type="button"
                    disabled={busy || Boolean(selecting) || full}
                    onClick={() => void selectService(option)}
                    className="w-full h-11 rounded-xl bg-[#0B1F33] text-[#F5A524] font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-[0.99] transition-all cursor-pointer shadow-sm"
                  >
                    {selecting === option.route.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Opening service…
                      </>
                    ) : full ? (
                      'Capacity reached (Sold out)'
                    ) : (
                      <>
                        Select route & seats
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </article>
              );
            })
          )}
        </section>
      )}

      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => navigate('/tickets')}
          className="text-xs font-semibold text-[#0B1F33] hover:underline"
        >
          {t.registration.alreadyBooked}
        </button>
      </div>
    </div>
  );
};
