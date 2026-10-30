export type TripStatus =
  | 'AGGREGATING'
  | 'THRESHOLD_MET'
  | 'SCHEDULED'
  | 'BOARDING'
  | 'DEPARTED'
  | 'COMPLETED'
  | 'CANCELLED';

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'WAITING_DISPATCH'
  | 'CONFIRMED'
  | 'BOARDED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface RouteStop {
  id: string;
  sequence_order: number;
  stop_order?: number;
  stop_name: string;
  distance_from_origin_km: number;
  latitude: number | null;
  longitude: number | null;
}

export interface BusRoute {
  id: string;
  route_code: string;
  name: string;
  origin: string;
  destination: string;
  distance_km: number;
  fixed_fare: number;
  stops: RouteStop[];
}

export interface Trip {
  id: string;
  route_id: string;
  route_name: string;
  origin: string;
  destination: string;
  status: TripStatus;
  demand_count: number;
  confirmed_bookings_count: number;
  target_threshold: number;
  capacity: number;
  seats_remaining: number;
  boarded_count: number;
  base_fare: number;
  departure_time: string | null;
  train_number: string;
  travel_date: string;
  destination_stop_id: string;
  deadline_at: string | null;
  bus_id: string | null;
  bus_registration: string | null;
  conductor_id: string | null;
  conductor_name: string | null;
  threshold_met: boolean;
  route?: BusRoute;
}

export interface TicketPayload {
  id: string;
  ticket_id: string;
  ticket_reference: string;
  qr_content: string;
  qr_data_url?: string | null;
  status: string;
  issued_at: string;
  expires_at: string;
}

export interface Booking {
  id: string;
  booking_id: string;
  booking_reference: string;
  passenger_id: string;
  passenger_name: string;
  passenger_phone: string;
  passenger_email: string;
  trip_id: string;
  route_id: string;
  destination_stop_id: string;
  destination_stop: RouteStop | null;
  route_name: string;
  seat_count: number;
  fare_amount: number;
  status: BookingStatus;
  payment_status: string;
  created_at: string;
  trip: Trip;
  route: BusRoute;
  ticket?: TicketPayload;
  ticket_id?: string;
  ticket_reference?: string;
  qr_content?: string;
}

export interface PassengerProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  trip_id: string | null;
  kind: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

export interface ServiceOption {
  trip_id: string | null;
  route: BusRoute;
  destination_stop: RouteStop;
  train_number: string;
  travel_date: string;
  status: string;
  capacity: number;
  confirmed_seats: number;
  seats_remaining: number;
  active_checkout_holds: number;
  fare_per_seat: number;
  deadline_at: string | null;
  target_threshold: number;
}
