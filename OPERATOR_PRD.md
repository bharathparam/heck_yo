# RailBus Operator Dashboard — Product Requirements Document (PRD)

**Document Version:** 1.0.0  
**Status:** Approved for System Design  
**Author:** Senior Product Designer & Transport Operations Software Engineer  
**Target Platform:** Desktop / Tablet Responsive Web (Min resolution: 1024x768, Optimized for 1920x1080 Control Rooms)

---

## 1. Executive Summary & Product Vision

RailBus is an intermodal, demand-responsive transit aggregator connecting passenger rail services with dynamic first/last-mile bus transport. 

Traditional fixed-route feeder buses either run empty during off-peak hours (incurring deadhead costs and fuel wastage) or suffer from capacity overflows during peak train arrivals. RailBus solves this through a **demand-driven threshold model**:
1. Passengers arriving via scheduled trains pre-book bus feeder connections to municipal hubs, regional zones, and suburban clusters.
2. Demand aggregates in real time against predefined trip slots.
3. When a proposed trip reaches the **critical viability threshold** (default: **20 confirmed, paid bookings**), the trip transitions from `AGGREGATING` to `ELIGIBLE`.
4. The **RailBus Operator Dashboard** is the nerve center where fleet operators and transit dispatchers monitor incoming rail arrivals, assess passenger demand density, approve or reject eligible trips, and assign available buses and licensed conductors.

The vision of the Operator Dashboard is to furnish dispatchers with an operational cockpit providing sub-second situational awareness, zero-friction approval and dispatch workflows, and bulletproof conflict prevention for rolling stock and crew.

---

## 2. Operational Context & Problem Statement

### 2.1 The Operational Challenge
Dispatchers in transport control rooms operate under extreme cognitive load:
- Train schedules are subject to dynamic delays, track changes, and unexpected disruptions.
- Passenger demand fluctuates based on weather, train composition, and peak commuting cycles.
- Fleet assets (buses) and human assets (conductors) are strictly constrained by licensing, seating capacities, depot locations, and labor shift regulations.
- Delayed approval decisions lead to stranded passengers, missed booking cutoffs, or vehicle deadheading.

### 2.2 The RailBus Solution
The Operator Dashboard bridges the gap between passive train arrival timetables and active road vehicle dispatch:
- Synchronizes with train arrival feeds to align bus departure windows with actual passenger platform egress times (typically arrival + 10 to 15 minutes).
- Automatically aggregates paid bookings, visually surfacing progress bars toward the minimum threshold ($N \ge 20$).
- Enforces strict operational guardrails: trips cannot be approved unless validated by the backend; assets cannot be double-booked; conductors cannot be assigned overlapping runs.

---

## 3. User Personas & Role-Based Access Control (RBAC)

### 3.1 Personas
1. **Sarah Jenkins — Head of Transport Operations (Admin)**
   - *Goal:* High-level fleet utilization oversight, route profitability, driver shift compliance, system parameter configuration (e.g., base threshold policies, route definitions).
   - *Pain Points:* Lack of unified reporting, blind spots in feeder conversion rates, regulatory reporting overhead.
2. **Marcus Chen — Real-Time Transit Dispatcher / Operator (Operator)**
   - *Goal:* Continuous monitoring of train arrivals, rapid review of eligible trips, immediate assignment of buses and conductors, handling delayed trains.
   - *Pain Points:* Slow interfaces, modal fatigue, double-booking errors during rapid reassignment, lack of clear visibility into passenger manifests.

### 3.2 Role Matrix

| Capability / Action | Operator | Operations Admin | Notes |
| :--- | :---: | :---: | :--- |
| **View Dashboard Overview & KPIs** | Yes | Yes | Read-only operational stats |
| **View Train Arrivals & Delays** | Yes | Yes | Live intermodal timetable sync |
| **Monitor Demand Aggregation** | Yes | Yes | Real-time threshold progress bars |
| **Approve / Reject Eligible Trips** | Yes | Yes | Core operational action |
| **Assign / Reassign Fleet & Crew** | Yes | Yes | Conflict checks strictly enforced |
| **View Passenger Manifests** | Yes | Yes | Redacted PII (names, seat #, boarding status) |
| **Register New Bus Assets** | No | Yes | Fleet procurement & registration |
| **Register / Deactivate Conductors** | No | Yes | HR & certification management |
| **Override System Thresholds** | No | Yes | Admin audit log required |
| **Export Operational Analytics** | No | Yes | CSV/PDF export for transit authorities |

---

## 4. Business & Operational Rules

### 4.1 Trip Lifecycle State Machine

```
[SCHEDULED / AGGREGATING] 
       │
       ├── (Confirmed Bookings >= 20 & Booking Window Open)
       ▼
   [ELIGIBLE]
       │
       ├── [Operator Approves] ──► [APPROVED]
       │                                │
       │                                ├── [Bus + Conductor Assigned] ──► [ASSIGNED]
       │                                │                                      │
       │                                │                                      ├── [Dispatch / Departure] ──► [IN_PROGRESS] ──► [COMPLETED]
       │                                └── [Cutoff Reached without Assign] ──► [UNFULFILLED] (Alert Admin)
       │
       └── [Operator Rejects OR Cutoff Elapsed with Bookings < 20]
               │
               ▼
          [REJECTED] / [CANCELLED] ──► Triggers Automated Full Refund in Backend
```

### 4.2 The Threshold Mechanism ($N \ge 20$)
- **Base Threshold:** Minimum 20 confirmed, paid tickets.
- **Dynamic Policy:** The threshold is defined by route profile in the backend (e.g., standard shuttle = 20, high-capacity articulated bus = 35). The dashboard **never** hardcodes this value; it consumes `threshold` from `GET /api/trips/{id}/demand`.
- **Pre-Threshold State:** Trips with 1–19 bookings remain in status `AGGREGATING`. Operators can observe velocity, but the "Approve" CTA is disabled.
- **Threshold Reached State:** At booking count $\ge 20$, the trip status updates to `ELIGIBLE`. A real-time notification sounds/flashes in the dashboard.
- **Cutoff Window (T-minus 30 mins):** If a trip has not reached threshold 30 minutes prior to scheduled departure, the backend automatically transitions the trip to `CANCELLED` and triggers customer refunds. Operators may manually reject early if fleet availability is zero.

### 4.3 Assignment Integrity & Anti-Collision
- **Bus Overlap Prevention:** A bus assigned to Trip $A$ (14:00 – 14:45) cannot be assigned to Trip $B$ if $Trip B_{start} < Trip A_{end} + Buffer_{turnaround}$ (standard turnaround: 15 minutes).
- **Conductor Overlap Prevention:** A conductor cannot be double-booked across overlapping trips or during mandatory rest periods.
- **Backend Authority:** The frontend conducts client-side conflict pre-validation, but the shared FastAPI backend is the sole source of truth and enforces DB row-level locking.

---

## 5. Cross-System Dependencies

```
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│     Passenger Web / App         │           │    Conductor Mobile App / PWA   │
│  - Book ticket on train route   │           │  - View assigned trip manifest  │
│  - Payment processed            │           │  - Scan passenger boarding QR   │
│  - Receive trip status updates  │           │  - Report departure / arrival   │
└────────────────┬────────────────┘           └────────────────▲────────────────┘
                 │                                             │
                 │ (Booking confirmed)                         │ (Manifest synced)
                 ▼                                             │
      ┌────────────────────────────────────────────────────────┴───────┐
      │                   Shared FastAPI Backend                       │
      │  - PostGIS / PostgreSQL / Supabase Auth Database              │
      │  - Business logic, threshold evaluation, state transitions     │
      │  - WebSocket / SSE live event broadcaster                     │
      └───────────────────────────────▲────────────────────────────────┘
                                      │
                                      │ (REST APIs + Live Event Stream)
                                      ▼
                      ┌───────────────────────────────┐
                      │    RailBus Operator Web App   │
                      │  - Monitor demand velocity    │
                      │  - Approve / Reject trips     │
                      │  - Assign Fleet & Conductors  │
                      │  - Live route & delay map     │
                      └───────────────────────────────┘
```

1. **Passenger App Dependency:**
   - Passenger purchases directly feed confirmed booking counts.
   - Passenger cancellations decrements confirmed count. If count drops below threshold before operator approval, trip reverts from `ELIGIBLE` to `AGGREGATING`.
   - Trip approval instantly notifies passengers with confirmation and QR boarding pass issuance.
2. **Conductor App Dependency:**
   - Assignment on Operator Dashboard pushes the duty roster to the conductor's mobile interface.
   - Conductor check-in and QR ticket scans stream boarding rates back to the Operator Dashboard.
3. **Train Schedule & Telemetry Feed:**
   - Live GTFS-RT or station arrival feeds provide actual arrival times ($\Delta t$). 
   - Delays are rendered directly against the associated bus feeder connection, enabling dispatchers to hold or re-time trips.

---

## 6. Key Performance Indicators (KPIs) & Success Metrics

1. **Trip Approval Lead Time:** Average elapsed time from trip becoming `ELIGIBLE` to operator `APPROVED` (Target: $< 3$ minutes).
2. **Threshold Conversion Rate:** Percentage of `AGGREGATING` trips that reach 20+ bookings and proceed to completed trips (Target: $> 75\%$).
3. **Fleet Utilization Rate:** Ratio of revenue-generating operational hours to total bus fleet deployment.
4. **Deadhead Reduction:** Reduction of unbooked, empty bus miles to $< 5\%$.
5. **On-Time Feeder Departure:** Bus departure within 12 minutes of actual train passenger platform arrival.

---

## 7. Non-Functional Requirements (NFRs)

- **Latency:** Dashboard API round-trips $< 250$ms under nominal load. Real-time demand counters update within $500$ms of payment capture.
- **Reliability:** 99.95% uptime during operational service hours (05:00 – 01:00).
- **Security:** Strict Supabase JWT validation on every HTTP request; role claims (`operator`, `admin`) validated server-side. Zero sensitive passenger payment PII displayed on dispatch screens.
- **Browser Compatibility:** Chromium 110+, Safari 16+, Firefox 115+, Microsoft Edge.
- **Display Optimization:** Responsive grid system tested at 1024x768 (iPad landscape/field console), 1440x900 (dispatcher laptop), and 1920x1080 / 2560x1440 (control room video walls).
