export type UserRole = 'ADMIN' | 'OPERATOR' | 'CONDUCTOR' | 'PASSENGER';

export type TripStatus =
  | 'AGGREGATING'
  | 'THRESHOLD_MET'
  | 'READY_TO_DISPATCH'
  | 'SCHEDULED'
  | 'DISPATCHED'
  | 'BOARDING'
  | 'DEPARTED'
  | 'COMPLETED'
  | 'CANCELLED';

export type BusStatus = 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE';
export type ConductorStatus = 'AVAILABLE' | 'ASSIGNED';
export type IntegrationState = 'NOT_CONNECTED' | 'SYNTHETIC_DATA' | 'LIVE';

export interface AuthUser {
  access_token: string;
  token_type: string;
  role: UserRole;
  user_id: string;
  id?: string;
  email: string;
  full_name: string;
}

export interface UserProfile {
  id: string;
  user_id?: string;
  email: string;
  full_name: string;
  phone?: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Bus {
  id: string;
  registration_number: string;
  capacity: number;
  model: string;
  status: BusStatus;
  current_trip_id?: string | null;
  created_at: string;
}

export interface Conductor {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  status: ConductorStatus;
  current_trip_id?: string | null;
}

export interface RouteStop {
  id: string;
  stop_name: string;
  stop_order?: number;
  sequence_order?: number;
  distance_from_origin_km: number;
  latitude: number | null;
  longitude: number | null;
}

export interface BusRoute {
  id: string;
  name: string;
  route_code: string;
  origin: string;
  destination: string;
  distance_km: number;
  fixed_fare: number;
  stops: RouteStop[];
}

export interface Trip {
  id: string;
  route_id: string;
  route_name?: string | null;
  origin?: string | null;
  destination: string;
  status: TripStatus;
  demand_count: number;
  confirmed_bookings_count: number;
  target_threshold: number;
  capacity: number;
  seats_remaining: number;
  boarded_count: number;
  base_fare: number;
  departure_time?: string | null;
  travel_date: string;
  train_number: string;
  destination_stop_id?: string;
  deadline_at?: string | null;
  bus_id?: string | null;
  bus_registration?: string | null;
  conductor_id?: string | null;
  conductor_name?: string | null;
  threshold_met?: boolean;
  tickets_issued?: number;
  route?: BusRoute;
}

export interface OperatorBooking {
  id: string;
  booking_reference: string;
  passenger_id: string;
  passenger_name: string;
  passenger_phone: string;
  passenger_email: string;
  trip_id: string;
  route_id: string;
  route_name: string;
  destination?: string;
  destination_stop?: { stop_name: string };
  train_number?: string;
  seat_count: number;
  seats_count?: number;
  fare_amount: number;
  total_fare?: number;
  status: string;
  payment_status: string;
  created_at: string;
}

export interface OperationalEvent {
  id: string;
  event_type: string;
  trip_id?: string | null;
  route_name?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  actor_id?: string | null;
  details?: string | Record<string, unknown> | null;
  message?: string;
  created_at: string;
}

export interface OperatorNotification {
  id: string;
  trip_id?: string | null;
  kind: string;
  title: string;
  message: string;
  created_at: string;
  read_at?: string | null;
}

export interface TrainPrediction {
  train_number: string;
  train_name: string;
  origin: string;
  destination: string;
  scheduled_arrival: string;
  estimated_arrival: string;
  delay_minutes: number;
  platform: string;
  status: string;
  feeder_demand_status: string;
  confidence_score: number;
  is_synthetic: boolean;
}

export interface SmartSyncStatus {
  integration_state: IntegrationState;
  badge_text: string;
  is_synthetic: boolean;
  disclaimer: string;
  last_sync_at: string;
  trains: TrainPrediction[];
}

export interface ManifestPassenger {
  ticket_id: string;
  ticket_reference: string;
  passenger_name: string;
  passenger_phone?: string | null;
  seat_count: number;
  status: string;
  boarded_at?: string | null;
}

export interface Manifest {
  trip_id: string;
  route_name: string;
  status: TripStatus;
  total_passengers: number;
  boarded_count: number;
  manifest: ManifestPassenger[];
}

export interface ConductorTrip {
  id: string;
  route_name: string;
  origin: string;
  destination: string;
  status: TripStatus;
  train_number?: string | null;
  travel_date?: string;
  bus_registration?: string | null;
  capacity: number;
  boarded_count: number;
  total_confirmed_passengers: number;
  departure_time?: string | null;
}
