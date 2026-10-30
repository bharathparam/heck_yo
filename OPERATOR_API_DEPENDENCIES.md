# RailBus Operator Dashboard — API Dependencies & Integration Specifications

**Document Version:** 1.0.0  
**Backend Protocol:** FastAPI Shared Backend with PostgreSQL / Supabase  
**Authentication:** HTTP Bearer Header (`Authorization: Bearer <Supabase_JWT>`)  
**Content-Type:** `application/json`

---

## 1. Integration Rules & Standards

1. **Shared Single Source of Truth:**
   The Operator Dashboard interfaces directly with the shared FastAPI backend. The dashboard **does not** maintain independent business logic, does not calculate financial refunds independently, and does not hardcode the 20-ticket threshold.
2. **Strict Schema Conformance:**
   The dashboard strictly matches the approved endpoint paths and schema fields. No invented routes or ad-hoc query parameters are permitted.
3. **Mocking Standards:**
   When running offline or in development environments prior to complete backend deployment, client-side mocks must faithfully mirror these exact schemas, including HTTP status codes (`200`, `201`, `400`, `401`, `403`, `404`, `409`, `422`).
4. **Idempotency & Concurrency:**
   Approval (`/approve`) and assignment (`/assign`) endpoints are idempotent; subsequent submissions on already approved/assigned entities return a clean `409 Conflict` response with an explanatory payload.

---

## 2. Core API Endpoint Specifications

### 2.1 `GET /api/operator/dashboard`
Returns high-level aggregate operational metrics for the active service day.

- **Query Parameters:**
  - `date` (optional, string `YYYY-MM-DD`): Defaults to current day.
  - `station_id` (optional, string): Filter by primary train station hub.
- **Success Response (`200 OK`):**
```json
{
  "timestamp": "2026-10-30T09:30:00Z",
  "summary": {
    "total_bookings": 842,
    "confirmed_bookings": 765,
    "active_trips": 14,
    "eligible_trips": 6,
    "approved_trips": 8,
    "trips_in_progress": 5,
    "buses_available": 12,
    "conductors_available": 9
  },
  "alerts": [
    {
      "id": "ALT-101",
      "type": "TRAIN_DELAY",
      "severity": "HIGH",
      "message": "Train EXP-104 from Central Station delayed by 18 minutes. 3 feeder trips impacted.",
      "related_entity_id": "TRN-104",
      "created_at": "2026-10-30T09:28:10Z"
    },
    {
      "id": "ALT-102",
      "type": "THRESHOLD_REACHED",
      "severity": "MEDIUM",
      "message": "Trip RB-402 has reached 22 confirmed bookings. Approval required.",
      "related_entity_id": "TRP-402",
      "created_at": "2026-10-30T09:29:45Z"
    }
  ]
}
```

---

### 2.2 `GET /api/operator/trips`
Retrieves a paginated list of trips managed by the operator, filterable by status, date, or route.

- **Query Parameters:**
  - `status` (optional, string): `AGGREGATING` | `ELIGIBLE` | `APPROVED` | `ASSIGNED` | `IN_PROGRESS` | `COMPLETED` | `REJECTED` | `CANCELLED`
  - `date` (optional, string `YYYY-MM-DD`)
  - `route_id` (optional, string)
  - `page` (optional, integer, default: 1)
  - `limit` (optional, integer, default: 20)
- **Success Response (`200 OK`):**
```json
{
  "total": 48,
  "page": 1,
  "limit": 20,
  "data": [
    {
      "id": "TRP-402",
      "trip_code": "RB-402",
      "route": {
        "id": "RT-01",
        "name": "Central Rail Hub -> Silicon Park Tech District",
        "origin": "Central Rail Terminal",
        "destination": "Silicon Park Zone B",
        "estimated_duration_minutes": 25,
        "distance_km": 14.2
      },
      "scheduled_departure": "2026-10-30T10:15:00Z",
      "booking_cutoff_time": "2026-10-30T09:45:00Z",
      "status": "ELIGIBLE",
      "threshold": 20,
      "confirmed_bookings": 22,
      "pending_bookings": 3,
      "connected_train": {
        "train_number": "IC-104",
        "origin": "North Station",
        "scheduled_arrival": "2026-10-30T10:00:00Z",
        "estimated_arrival": "2026-10-30T10:00:00Z",
        "status": "ON_TIME",
        "delay_minutes": 0
      },
      "assigned_bus": null,
      "assigned_conductor": null,
      "created_at": "2026-10-30T07:00:00Z",
      "updated_at": "2026-10-30T09:29:45Z"
    },
    {
      "id": "TRP-403",
      "trip_code": "RB-403",
      "route": {
        "id": "RT-02",
        "name": "Central Rail Hub -> Medical City Campus",
        "origin": "Central Rail Terminal",
        "destination": "Hospital Plaza",
        "estimated_duration_minutes": 35,
        "distance_km": 19.8
      },
      "scheduled_departure": "2026-10-30T10:45:00Z",
      "booking_cutoff_time": "2026-10-30T10:15:00Z",
      "status": "APPROVED",
      "threshold": 20,
      "confirmed_bookings": 25,
      "pending_bookings": 0,
      "connected_train": {
        "train_number": "EXP-88",
        "origin": "Capital City",
        "scheduled_arrival": "2026-10-30T10:30:00Z",
        "estimated_arrival": "2026-10-30T10:30:00Z",
        "status": "ON_TIME",
        "delay_minutes": 0
      },
      "assigned_bus": {
        "id": "BUS-07",
        "plate_number": "KA-01-EB-4412",
        "capacity": 32
      },
      "assigned_conductor": {
        "id": "CND-03",
        "full_name": "Marcus Vance",
        "badge_id": "CND-992"
      },
      "created_at": "2026-10-30T07:00:00Z",
      "updated_at": "2026-10-30T09:15:00Z"
    }
  ]
}
```

---

### 2.3 `GET /api/trips/{id}/demand`
Retrieves granular real-time demand details and threshold metrics for a specific trip.

- **Path Parameter:**
  - `id` (string): Unique trip ID (e.g. `TRP-402`).
- **Success Response (`200 OK`):**
```json
{
  "trip_id": "TRP-402",
  "threshold": 20,
  "confirmed_bookings": 22,
  "pending_bookings": 3,
  "is_eligible": true,
  "booking_cutoff_time": "2026-10-30T09:45:00Z",
  "time_to_cutoff_seconds": 900,
  "total_revenue_estimated": 330.00,
  "currency": "USD",
  "demand_breakdown": {
    "standard_tickets": 19,
    "wheelchair_accessible_tickets": 3
  },
  "passengers": [
    {
      "booking_id": "BK-9021",
      "passenger_initials": "S. K.",
      "seat_count": 1,
      "booked_at": "2026-10-30T08:12:00Z",
      "payment_status": "PAID",
      "needs_wheelchair": false
    },
    {
      "booking_id": "BK-9022",
      "passenger_initials": "R. M.",
      "seat_count": 2,
      "booked_at": "2026-10-30T08:15:30Z",
      "payment_status": "PAID",
      "needs_wheelchair": true
    }
  ]
}
```

---

### 2.4 `POST /api/operator/trips/{id}/approve`
Approves an eligible trip for service. The backend strictly verifies that `confirmed_bookings >= threshold` and that the booking cutoff window has not elapsed.

- **Path Parameter:**
  - `id` (string): Trip ID.
- **Request Body:** None or optional dispatcher notes:
```json
{
  "notes": "Approved for 32-seater dispatch. Train on-time."
}
```
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "trip_id": "TRP-402",
  "status": "APPROVED",
  "approved_at": "2026-10-30T09:30:15Z",
  "approved_by": "usr-operator-01",
  "message": "Trip successfully approved. Proceed to bus and conductor assignment."
}
```
- **Error Responses:**
  - `400 Bad Request`: `{"detail": "Trip does not meet eligibility threshold (current: 18, required: 20)"}`
  - `409 Conflict`: `{"detail": "Trip is already in status APPROVED or higher"}`

---

### 2.5 `POST /api/operator/trips/{id}/reject`
Rejects a trip, terminating aggregation and immediately triggering automated full refunds to all confirmed passengers.

- **Path Parameter:**
  - `id` (string): Trip ID.
- **Request Body:**
```json
{
  "rejection_code": "INSUFFICIENT_FLEET",
  "reason": "Depot fleet at 100% capacity due to emergency maintenance.",
  "notify_passengers": true
}
```
- Standard `rejection_code` values:
  - `INSUFFICIENT_DEMAND`
  - `INSUFFICIENT_FLEET`
  - `CREW_UNAVAILABLE`
  - `TRAIN_CANCELLED`
  - `SEVERE_WEATHER`
  - `OPERATIONAL_OVERRIDE`
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "trip_id": "TRP-402",
  "status": "REJECTED",
  "rejected_at": "2026-10-30T09:31:00Z",
  "refund_count": 22,
  "refund_total": 330.00,
  "message": "Trip rejected. 22 passenger refunds queued."
}
```

---

### 2.6 `POST /api/operator/trips/{id}/assign`
Assigns a specific bus and conductor to an approved trip. The backend executes row-level locks and time-overlap conflict detection.

- **Path Parameter:**
  - `id` (string): Trip ID.
- **Request Body:**
```json
{
  "bus_id": "BUS-07",
  "conductor_id": "CND-03"
}
```
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "trip_id": "TRP-402",
  "status": "ASSIGNED",
  "assigned_bus": {
    "id": "BUS-07",
    "plate_number": "KA-01-EB-4412",
    "capacity": 32
  },
  "assigned_conductor": {
    "id": "CND-03",
    "full_name": "Marcus Vance",
    "badge_id": "CND-992"
  },
  "assigned_at": "2026-10-30T09:32:00Z",
  "message": "Bus and conductor assigned. Manifest pushed to conductor terminal."
}
```
- **Error Responses:**
  - `400 Bad Request`: `{"detail": "Bus capacity (20 seats) is lower than confirmed demand (22 passengers)"}`
  - `409 Conflict`: `{"detail": "Bus BUS-07 is already assigned to trip RB-390 during 10:00 - 11:00 window"}`
  - `409 Conflict`: `{"detail": "Conductor CND-03 has reached maximum continuous duty hours without mandatory rest"}`

---

### 2.7 `GET /api/buses`
Returns the rolling stock inventory and real-time operational availability.

- **Query Parameters:**
  - `status` (optional, string): `AVAILABLE` | `ASSIGNED` | `MAINTENANCE` | `ALL`
  - `min_capacity` (optional, integer)
- **Success Response (`200 OK`):**
```json
[
  {
    "id": "BUS-07",
    "plate_number": "KA-01-EB-4412",
    "model": "Volvo 9400 B8R",
    "capacity": 32,
    "has_wheelchair_ramp": true,
    "fuel_or_charge_pct": 88,
    "depot_location": "Central Depot Bay 4",
    "status": "AVAILABLE",
    "current_trip_id": null
  },
  {
    "id": "BUS-08",
    "plate_number": "KA-01-EB-5501",
    "model": "BYD K9 Electric",
    "capacity": 28,
    "has_wheelchair_ramp": true,
    "fuel_or_charge_pct": 42,
    "depot_location": "East Terminus",
    "status": "ASSIGNED",
    "current_trip_id": "TRP-399"
  }
]
```

---

### 2.8 `GET /api/conductors`
Returns conductor personnel roster, shift status, and assignment status.

- **Query Parameters:**
  - `status` (optional, string): `ON_DUTY_AVAILABLE` | `ASSIGNED_ACTIVE` | `ON_BREAK` | `OFF_DUTY`
- **Success Response (`200 OK`):**
```json
[
  {
    "id": "CND-03",
    "full_name": "Marcus Vance",
    "badge_id": "CND-992",
    "phone": "+1-555-019-2831",
    "status": "ON_DUTY_AVAILABLE",
    "shift_start": "2026-10-30T06:00:00Z",
    "shift_end": "2026-10-30T14:00:00Z",
    "hours_worked_today": 3.5,
    "current_trip_id": null
  },
  {
    "id": "CND-05",
    "full_name": "Elena Rostova",
    "badge_id": "CND-1104",
    "phone": "+1-555-019-8812",
    "status": "ASSIGNED_ACTIVE",
    "shift_start": "2026-10-30T08:00:00Z",
    "shift_end": "2026-10-30T16:00:00Z",
    "hours_worked_today": 1.5,
    "current_trip_id": "TRP-401"
  }
]
```

---

### 2.9 `GET /api/trips/{id}/analytics`
Provides operational performance statistics for an individual completed or active trip.

- **Path Parameter:**
  - `id` (string): Trip ID.
- **Success Response (`200 OK`):**
```json
{
  "trip_id": "TRP-402",
  "route_id": "RT-01",
  "demand_velocity_minutes": [
    { "time_interval": "08:00-08:15", "bookings": 4 },
    { "time_interval": "08:15-08:30", "bookings": 7 },
    { "time_interval": "08:30-08:45", "bookings": 6 },
    { "time_interval": "08:45-09:00", "bookings": 5 }
  ],
  "passenger_boarding_rate": {
    "total_confirmed": 22,
    "boarded_count": 18,
    "no_shows": 1,
    "awaiting": 3,
    "boarding_completion_pct": 81.8
  },
  "timing_performance": {
    "train_arrival_scheduled": "2026-10-30T10:00:00Z",
    "train_arrival_actual": "2026-10-30T10:04:00Z",
    "feeder_departure_scheduled": "2026-10-30T10:15:00Z",
    "feeder_departure_actual": "2026-10-30T10:17:00Z",
    "transfer_window_minutes": 13
  },
  "financials": {
    "fare_per_passenger": 15.00,
    "gross_revenue": 330.00,
    "estimated_fuel_cost": 42.50,
    "estimated_crew_cost": 35.00,
    "net_operating_margin": 252.50
  }
}
```

---

## 3. Supplementary Endpoints for Intermodal Operations

To deliver the complete user experience requested without inventing endpoints, the dashboard incorporates the shared system routes:
- `GET /api/trains/arrivals`: Ingests scheduled & real-time train arrivals (`train_id`, `scheduled_arrival`, `delay_minutes`, `status`).
- `GET /api/routes`: Route geometry, stop definitions, and distance matrix.
- `GET /api/trips/{id}/manifest`: Redacted passenger manifest for boarding oversight.

---

## 4. Cross-Application Data Flow Matrix

| Event / Trigger | Emitted By | Ingested By | Action Taken |
| :--- | :--- | :--- | :--- |
| **Passenger Books Ticket** | Passenger App | Shared DB / FastAPI | Confirmed booking counter increments. If count reaches 20, Trip status updates to `ELIGIBLE`. |
| **Trip Hits Threshold ($\ge 20$)** | Backend Event Engine | Operator Dashboard | Audio chime sounds; trip moves to top of Eligible Queue widget. |
| **Operator Approves Trip** | Operator Dashboard | Backend API | Status $\rightarrow$ `APPROVED`. Unlocks bus/conductor assignment selector. |
| **Operator Rejects Trip** | Operator Dashboard | Backend API | Status $\rightarrow$ `REJECTED`. Backend automatically dispatches full refund tasks to payment gateway. |
| **Bus + Conductor Assigned** | Operator Dashboard | Conductor Mobile PWA | Manifest downloads to conductor's device; trip appears on active duty schedule. |
| **Conductor Scans Passenger QR** | Conductor Mobile PWA | Operator Dashboard | Real-time boarding meter increments from `AWAITING` to `BOARDED`. |
| **Train Delayed by $>10$m** | GTFS-RT / Station API | Operator Dashboard | Dashboard highlights affected connecting feeder trips; suggests departure adjustment. |
