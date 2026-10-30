# RailBus Passenger Application: Open Questions, Conflicts & Backend Dependencies

**Document ID:** `PASSENGER_OPEN_QUESTIONS`  
**Version:** 1.0  
**Status:** Action Required from Backend Architect & Product Lead  
**Classification:** Pre-Implementation Architectural Registry

---

## 1. Executive Summary
This document captures all architectural conflicts between the **Context Briefing v2**, the **Google Stitch UI screens**, and the **FastAPI Backend Master Index**. 

In strict adherence to the project instructions, **zero assumptions have been silently resolved**. Every gap is cataloged below with its systemic impact, recommended default proposal, and exact backend action required.

---

## 2. Master Registry of Gaps, Conflicts & Dependencies

---

### GAP-01: Authentication Method & Endpoint Contract
- **Category:** Backend Dependency / Contract Specification
- **Context:** Google Stitch screen `9e4363448d8944388cd6aa4bce2cd91a` and `e478892722324b00a9d08fc453962adc` depict a mobile phone number input followed by a 6-digit OTP verification screen. However, the backend OpenAPI catalog lists only `POST /register` and `POST /login` with no dedicated `/auth/send-otp` or `/auth/verify-otp` endpoints.
- **System Impact:** If the backend requires email and password, the Stitch phone OTP UI cannot be implemented as designed.
- **Recommended Default Proposal:** 
  1. For the hackathon MVP, the frontend implements an identifier + password form supporting either phone or email on `POST /login` and `POST /register`.
  2. The 6-digit OTP screen is retained in the codebase as a dormant component, ready to be activated if Supabase Phone OTP or a custom OTP endpoint is exposed.
- **Action Required:** Backend team to specify the exact JSON request schema for `POST /login` and `POST /register`.

---

### GAP-02: Ticket & QR Payload Retrieval Endpoint
- **Category:** Backend Dependency / API Contract
- **Context:** The Master Index lists 26 endpoints. The ticket-specific endpoints (`POST /tickets/validate`, `POST /tickets/board`) are assigned exclusively to conductors. There is no standalone `GET /tickets/{id}` passenger endpoint.
- **System Impact:** The passenger app needs the HMAC-signed QR string and ticket metadata to display the digital pass and cache it offline.
- **Recommended Default Proposal:** 
  - Standardize that `GET /bookings/{id}` returns the full booking object with an embedded `ticket` object:
    ```typescript
    {
      id: "booking-uuid",
      tripId: "trip-uuid",
      status: "CONFIRMED",
      ticket: {
        ticketId: "ticket-uuid",
        ticketCode: "RB-MYS-88219",
        qrSignature: "hmac-sha256-hex-digest",
        issuedAt: "2026-10-30T14:30:00Z"
      }
    }
    ```
- **Action Required:** Backend architect to confirm that `GET /bookings/{id}` returns the embedded ticket and HMAC signature upon successful payment.

---

### GAP-03: Passenger Notification Delivery Channel
- **Category:** Backend Dependency / Realtime Integration
- **Context:** The database schema contains a `notifications` table, but no passenger endpoint (such as `GET /notifications` or `POST /notifications/{id}/read`) is present in the listed endpoints.
- **System Impact:** The app cannot populate a dedicated `/notifications` activity center via traditional REST polling.
- **Recommended Default Proposal:**
  - In-app notification alerts (e.g., *"Your bus has reached 20 bookings!"*, *"Bus KA-09-F-1234 assigned"*) are driven in real time by subscribing to Supabase Realtime changes on the passenger's own bookings (`public:bookings:passenger_id=eq.{id}`) and trip events.
  - An in-memory notification tray in Zustand displays alerts as temporary floating toasts during the active session.
- **Action Required:** Backend team to indicate whether a REST endpoint `GET /notifications` will be added in Phase 2 or if Realtime events are the sole delivery vehicle.

---

### GAP-04: Alternative Transport Suggestions Data Source
- **Category:** Data Model Gap / Content Strategy
- **Context:** The brief specifies that if a trip is cancelled or rejected, passengers must receive alternative transport suggestions. However, no `/alternatives` API endpoint exists.
- **System Impact:** Dynamic alternative queries cannot be fetched from the database.
- **Recommended Default Proposal:**
  - Implement a curated, static transit directory in the client (`/src/config/transitAlternatives.ts`) tailored specifically to Mysuru Railway Station:
    1. Regular KSRTC City Bus routes departing from the adjacent City Bus Stand (CBS) and station exit bays.
    2. Railway Prepaid Auto-Rickshaw counter location (Main Portico) with standard KSRTC fare charts.
    3. Emergency local taxi dispatch hotline numbers.
  - Clearly badge this view as *"Standard KSRTC Station Feeder Information"*.
- **Action Required:** Product lead to approve the static local transit guide approach for the hackathon.

---

### GAP-05: Trip Booking Cutoff & Departure Deadline
- **Category:** Business Logic / Contract Specification
- **Context:** Feeder buses cannot accept bookings indefinitely up to the departure second, because the operator needs time to review `ELIGIBLE` trips and dispatch vehicles. The endpoint schema does not define a `booking_cutoff_time` field.
- **System Impact:** Risk of passengers booking a seat on a bus that has already departed or is closed for dispatch.
- **Recommended Default Proposal:**
  - Establish a client-side operational cutoff rule: Bookings close **15 minutes prior to scheduled departure** (`scheduledDepartureTime - 15 minutes`).
  - Trips within this 15-minute window display `"Bookings Closed for this Departure"` and disable the checkout CTA.
- **Action Required:** Backend team to validate whether 15 minutes matches backend dispatch business rules.

---

### GAP-06: Refund Processing Contract & Status Visibility
- **Category:** Financial Pipeline / API Contract
- **Context:** When a passenger cancels via `POST /bookings/{id}/cancel`, or when an operator marks an `ELIGIBLE` trip as `REJECTED`, the passenger must receive a refund. What does the API return?
- **System Impact:** The UI must display accurate financial expectations to the passenger.
- **Recommended Default Proposal:**
  - `POST /bookings/{id}/cancel` returns:
    ```typescript
    {
      bookingId: "string",
      status: "CANCELLED",
      refundStatus: "PROCESSED", // or "PENDING"
      refundAmount: 70.00,
      refundReference: "REF-SIM-99218"
    }
    ```
  - The UI presents: *"Full refund of ₹70 simulated. In production, funds return to your payment source within 2-4 hours."*
- **Action Required:** Backend team to confirm refund fields in cancellation response schema.

---

### GAP-07: Route Stop Coordinates for MapLibre Rendering
- **Category:** Geospatial Rendering / API Contract
- **Context:** The tech stack includes MapLibre for route exploration. Does `GET /routes/{id}` include geographic coordinates (`latitude`, `longitude`) for each stop and polyline GeoJSON?
- **System Impact:** MapLibre requires geospatial coordinates to render stop markers and the bus path.
- **Recommended Default Proposal:**
  - If `GET /routes/{id}` returns `stops: Array<{ stopName, latitude, longitude }>`, MapLibre renders the interactive map.
  - If coordinates are absent or null, the client gracefully degrades to a high-contrast vertical transit timeline component.
- **Action Required:** Backend team to confirm coordinate inclusion in `BusRouteDetail`.

---

### GAP-08: Supabase Realtime Channel Names & RLS Policies
- **Category:** Infrastructure / Security Policy
- **Context:** The client requires WebSocket subscriptions to `trips` and `bookings`. Supabase Realtime enforces Row Level Security (RLS).
- **System Impact:** If RLS policies do not grant `SELECT` access to authenticated passengers on the `trips` table, WebSocket connections will be silently refused.
- **Recommended Default Proposal:**
  - Channels are standardized as:
    - `public:trips:id=eq.{tripId}` (Publicly readable for live demand counts).
    - `public:bookings:id=eq.{bookingId}` (Restricted by RLS to `auth.uid() == passenger_id`).
- **Action Required:** Backend architect to verify RLS policies permit passenger tokens to subscribe to `trips` and their own `bookings`.

---

### GAP-09: Maximum Seat Limit per Passenger Booking
- **Category:** Business Logic / Form Validation
- **Context:** The Stitch seat map was replaced with a seat-count stepper (`1 to N`). Does the backend enforce a maximum seat threshold per booking?
- **System Impact:** An unbounded stepper could allow a single user to artificially trigger the 20-seat threshold.
- **Recommended Default Proposal:**
  - Cap the passenger seat stepper at a maximum of **6 seats** per individual transaction (aligning with standard IRCTC/KSRTC family booking guidelines).
- **Action Required:** Product lead to confirm the 6-seat cap.

---

### GAP-10: Operator Trip Rejection & Automatic Mass Refund
- **Category:** Multi-User Orchestration / Lifecycle
- **Context:** A trip reaches 20 bookings and enters `ELIGIBLE`. The operator reviews the fleet and sets the trip to `REJECTED` (e.g. no spare buses available). What happens to the 20+ paid bookings?
- **System Impact:** Passengers who paid upfront must be promptly informed and refunded.
- **Recommended Default Proposal:**
  - When trip becomes `REJECTED`, backend automatically transitions all associated bookings from `CONFIRMED` to `REFUNDED`.
  - The passenger app's Realtime listener detects this, displays an alert dialog, marks the ticket pass as `Trip Not Approved (Refunded)`, and offers the **"View Alternative City Transit"** CTA.
- **Action Required:** Backend and Operator teams to confirm mass-cancellation cascade behavior.

---

## 3. Reconciled Stitch Screen Conflicts Matrix

| Screen / Feature | Stitch Design Original | Context Briefing v2 Reality | Reconciled UI Implementation |
| :--- | :--- | :--- | :--- |
| **Seat Selection** | Interactive visual bus seat layout map (`6c7da395c9de48cd9915f1669a70dad3`). | **Out of Scope.** Data model has 16 tables with no seat table. KSRTC city buses have open seating. | Replaced with clean numeric stepper `[-] [ 2 ] [+]` (range 1-6) with fare multiplication. |
| **Payment Timing & Copy** | Footer copy: *"You pay only if the bus is confirmed"*. | **Invalidated.** Payment must be confirmed upfront before demand is counted. | Copy updated: *"Payment is completed now to confirm your demand toward the 20-passenger threshold. If not approved, you receive an immediate full refund."* |
| **Trip Status Labeling** | Simple binary: "Waiting" vs "Confirmed". | Master Index defines 7 discrete operational statuses (`OPEN`, `ELIGIBLE`, `APPROVED`, etc.). | Replaced with comprehensive passenger-friendly status badges mapped in `PASSENGER_UI_FLOW.md`. Never promises dispatch prematurely. |
| **Login Flow** | Mobile Phone Number + 6-digit OTP code. | Backend exposes `POST /login` and `POST /register` without public OTP endpoint. | Adapted form fields to handle credentials while documenting OTP endpoint requirement. |
