# RailBus Passenger Application: Cross-Team Coordination & Service Contracts

**Document ID:** `PASSENGER_COORDINATION`  
**Version:** 1.0  
**Stakeholders:** Passenger PWA Team, Backend Architect, Operator/Conductor App Team  
**Status:** Under Review (Awaiting User Sign-off)

---

## 1. Overview & Multi-App Ecosystem Architecture
The RailBus transit ecosystem consists of three interconnected systems operating over a unified FastAPI backend and Supabase infrastructure:
1. **Passenger Web App (PWA):** Demand registration, upfront payment simulation, live demand tracking, and offline digital ticket presentation.
2. **Operator Web App:** Fleet monitoring, trip demand aggregation, manual trip approval/rejection (`ELIGIBLE` -> `APPROVED` / `REJECTED`), bus vehicle assignment, and conductor scheduling.
3. **Conductor Mobile App:** Platform boarding verification, hardware/camera QR scanning, ticket validation, and passenger manifest management.

To guarantee seamless integration during the hackathon sprint, this document formalizes the explicit interface requirements and expectations between teams.

```
+---------------------------------------------------------------------------------------------------+
|                                   Unified FastAPI Backend & Supabase                              |
+---------------------------------------------------------------------------------------------------+
       ^                                                 ^                                  ^
       | REST & Realtime                                 | REST & Realtime                  | REST & Realtime
       v                                                 v                                  v
+-----------------------------+          +-----------------------------+     +-----------------------------+
|    Passenger PWA (Our App)  |          |      Operator Web App       |     |     Conductor Mobile App    |
|  - Register trip demand     |          |  - Monitor 20-seat threshold|     |  - Scan passenger HMAC QR   |
|  - Upfront payment sim      |          |  - Approve / Reject trips   |     |  - Verify ticket validity   |
|  - Display offline QR pass  |          |  - Assign bus & conductor   |     |  - Mark passenger boarded   |
+-----------------------------+          +-----------------------------+     +-----------------------------+
```

---

## 2. Dependencies on the Backend Architect

The Passenger PWA team requires prompt resolution and contract freezing on the following backend items:

| Item # | Technical Requirement | Specific Question / Request to Backend Team | Impact on Passenger App |
| :--- | :--- | :--- | :--- |
| **BE-01** | **Authentication Payload Specification** | Does `POST /login` and `POST /register` accept `{ email, password }` or `{ phone, password }` or `{ phone, otp }`? If phone OTP is required, is it handled directly via Supabase Auth SDK or custom FastAPI endpoints? | Form fields and validation on `LoginScreen.tsx` and `VerifyCodeScreen.tsx`. |
| **BE-02** | **Ticket & QR Embedding in Booking Endpoint** | Can the backend guarantee that `GET /bookings/{id}` returns the complete `ticket` object—including `ticket_id`, `ticket_code`, `issued_at`, and the server HMAC-signed `qr_signature`? | Eliminates the need for a separate passenger ticket endpoint and guarantees atomic ticket caching. |
| **BE-03** | **OpenAPI Spec & Seed Data Availability** | Provide the auto-generated `/openapi.json` schema and sample JSON fixtures in `/seeds/` (trains, routes, stops, trips). | Generates typed TypeScript contracts and populates our local Mock API Adapter. |
| **BE-04** | **Supabase Realtime Channel Standards** | Confirm exact channel naming convention and RLS policies for table subscriptions: e.g., `public:trips:id=eq.<trip_id>`. Confirm whether anonymous/passenger tokens have SELECT rights on the `trips` table. | Prevents silent Realtime WebSocket authorization rejections in the browser. |
| **BE-05** | **Route Stop Geographic Coordinates** | Does `GET /routes/{id}` return GeoJSON coordinates (`[longitude, latitude]`) for each stop in the route? | Required for MapLibre GL polyline rendering on the route detail screen. If absent, fallback to timeline list is triggered. |
| **BE-06** | **Automated Refund Trigger on Trip Rejection** | When an operator sets a trip to `REJECTED`, does the backend background worker automatically mark associated bookings as `REFUNDED` and trigger payment simulation reversals? | Dictates whether passenger UI polls for refund status or immediately updates the ticket status banner. |
| **BE-07** | **Trip Booking Cutoff Window** | How many minutes prior to scheduled bus departure does the backend stop accepting new bookings for an `OPEN` trip (e.g. 15 minutes before departure)? | Allows the passenger app to disable the "Book" button and display a "Booking Closed for this Departure" label. |

---

## 3. Coordination with the Operator Application Team

The Operator App directly triggers the state transitions that govern the passenger's experience:

### 3.1 Trip Approval Lifecycle (`ELIGIBLE` -> `APPROVED` / `REJECTED`)
1. **Threshold Trigger:** When 20 confirmed, prepaid passengers book a trip, the backend automatically transitions the trip status from `OPEN` to `ELIGIBLE`.
2. **Operator Action:**
   - **Approval:** Operator confirms vehicle availability and sets status to `APPROVED`.
     - *Passenger App Reaction:* Within 200ms of the Supabase Realtime event, the passenger's ticket badge flips from amber `"Goal Reached - In Review"` to green `"Bus Confirmed!"`.
   - **Rejection:** If no buses or drivers are available, operator marks status as `REJECTED`.
     - *Passenger App Reaction:* Ticket status flips to red `"Trip Not Approved"`. An immediate banner informs the passenger that their full payment has been refunded, and presents a direct link to **"View Alternative City Transit"**.

### 3.2 Vehicle & Conductor Assignment (`APPROVED` -> `ASSIGNED`)
1. When the operator assigns a specific KSRTC bus and conductor to the trip, the backend updates the `trips` record with:
   - `bus_number` (e.g., `KA-09-F-4412`)
   - `conductor_name` (e.g., `Ramesh K.`)
   - `boarding_bay` (e.g., `Bay 4, KSRTC Feeder Terminal`)
2. The Passenger PWA listens to this change and automatically populates these operational details onto the passenger's digital ticket screen.

---

## 4. Coordination with the Conductor Mobile Application Team

The Conductor App is the physical validation endpoint for digital tickets issued by the Passenger PWA:

```
+-----------------------------+                          +-----------------------------+
|    Passenger PWA (Screen)   |                          |    Conductor Mobile App     |
+-----------------------------+                          +-----------------------------+
|                             |                          |                             |
|  [ Displays HMAC QR Code ]  | ===== Camera Scan =====> |  [ Scans QR Code ]          |
|  - Encodes:                 |                          |  - Decodes: ticket_id       |
|    ticket_id: UUID          |                          |  - Verifies HMAC signature  |
|    trip_id: UUID            |                          |  - Calls:                   |
|    signature: HMAC-SHA256   |                          |    POST /tickets/validate   |
|                             |                          |    POST /tickets/board      |
|                             | <=== Scanned Event ===== |                             |
|  [ Status: BOARDED ]        |      (via Realtime)      |  [ Screen: Passenger Conf ] |
+-----------------------------+                          +-----------------------------+
```

### Critical QR Code Agreement:
1. **Payload Format:** The QR code rendered on the passenger's phone is a compact JSON string containing only three fields:
   ```json
   {
     "t_id": "7f8b9c2a-1122-4433-8899-abcdef012345",
     "tr_id": "3e4f5a6b-9988-7766-5544-123456789abc",
     "sig": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
   }
   ```
2. **Zero Passenger-Side Tampering:** The passenger app **never** creates or modifies `sig`. It renders the exact string returned by the backend in `GET /bookings/{id}`.
3. **Boarding Feedback:** When the conductor scans the QR code and submits `POST /tickets/board`, the backend updates the booking status to `BOARDED`. If the passenger's phone is connected to the internet, their ticket screen updates immediately to show a green checkmark: `"Boarded at Mysuru Station"`. If the passenger's phone is offline, the conductor's scanner screen serves as the definitive proof of boarding.
