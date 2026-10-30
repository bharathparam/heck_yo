export type TripStatus =
  | 'AGGREGATING'
  | 'THRESHOLD_MET'
  | 'SCHEDULED'
  | 'BOARDING'
  | 'DEPARTED'
  | 'COMPLETED'
  | 'CANCELLED';

export type TicketStatus = 'ISSUED' | 'BOARDED' | 'EXPIRED' | 'CANCELLED';

export interface ConductorUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface ConductorTripSummary {
  id: string;
  route_name: string;
  origin: string;
  destination: string;
  status: TripStatus;
  bus_registration?: string;
  capacity: number;
  boarded_count: number;
  total_confirmed_passengers: number;
  departure_time?: string;
}

export interface PassengerManifestItem {
  ticket_id: string;
  ticket_reference: string;
  passenger_name: string;
  passenger_phone?: string;
  seat_count: number;
  status: TicketStatus;
  boarded_at?: string;
}

export interface ManifestResponse {
  trip_id: string;
  route_name: string;
  bus_registration?: string;
  status: TripStatus;
  total_passengers: number;
  boarded_count: number;
  manifest: PassengerManifestItem[];
}

export interface BoardTicketResponse {
  success: boolean;
  ticket_id: string;
  ticket_reference: string;
  passenger_name: string;
  boarded_at: string;
  boarded_count: number;
  total_passengers: number;
  message: string;
}

export interface OfflineBoardingItem {
  ticket_id: string;
  ticket_reference?: string;
  passenger_name?: string;
  boarded_at: string;
  device_id: string;
}

export interface OfflineSyncBatchResponse {
  trip_id: string;
  synced_count: number;
  failed_count: number;
  boarded_count: number;
  total_passengers: number;
  errors: string[];
}
