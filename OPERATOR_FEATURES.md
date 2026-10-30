# RailBus Operator Dashboard — Detailed Feature Specifications

**Document Version:** 1.0.0  
**Scope:** Functional Requirements, Screen Breakdown, Dashboard Widgets, and Operational User Journeys

---

## 1. Module & Feature Hierarchy

The Operator Dashboard is divided into 8 core functional modules:
1. **Authentication, RBAC & Session Management**
2. **Operations Command Center (Main Overview)**
3. **Train Arrival Management & Intermodal Synchronization**
4. **Demand Monitoring & Aggregation Pipeline**
5. **Trip Review, Approval & Cancellation Management**
6. **Fleet & Rolling Stock Management**
7. **Conductor & Crew Dispatch Management**
8. **Live Trip Operations, Passenger Manifests & Analytics**

---

## 2. Detailed Screen Breakdown & Widget Specifications

### Screen 1: Authentication & Role Selection (`/login`)
- **Purpose:** Secure authentication gateway for operators and administrators using Supabase Auth.
- **Components & Widgets:**
  - `AuthCard`: Form containing email, password, and single-sign-on option.
  - `RoleBadgeSelector`: Preview indicator showing resolved role (`Operator` vs `Operations Admin`) upon credential validation.
  - `EnvironmentBadge`: Non-production / Production environment indicator.
  - `SessionPersistenceHandler`: Automatically handles JWT refresh tokens and redirect to intended deep-link.
- **Key Interactions:**
  - Submit credentials $\rightarrow$ Supabase exchange $\rightarrow$ Store session in encrypted memory/secure cookie $\rightarrow$ Fetch user role from shared backend profile $\rightarrow$ Route to `/dashboard`.
  - Inactive session timeout alert after 30 minutes of inactivity.

---

### Screen 2: Operations Command Center — Overview (`/dashboard`)
- **Purpose:** High-density, real-time tactical overview of network status across rail arrivals, active demand clusters, fleet availability, and immediate operator action items.
- **Layout:** Top alert bar, 7 primary KPI telemetry cards, Split-pane layout: Action-Required Trips table (left $60\%$) + Mini Live Network Map & Arrival Feed (right $40\%$).
- **Widgets:**
  1. **`KpiTelemetryGrid` (7 Metric Cards):**
     - *Total Bookings Today:* Cumulative confirmed + pending bookings across all routes.
     - *Confirmed Bookings:* Confirmed paid passenger tickets across active service day.
     - *Eligible Trips (Action Needed):* Trips with demand $\ge 20$ awaiting operator approval (highlighted in prominent amber/pulsing badge).
     - *Approved Trips:* Trips approved by operator, awaiting vehicle/conductor assignment.
     - *Active / In-Progress Trips:* Vehicles currently en route on road segments.
     - *Buses Available:* Idle buses ready for immediate dispatch at terminal depot.
     - *Conductors Available:* Idle on-duty certified conductors.
  2. **`EligibleTripsQueueWidget`:**
     - Prioritized list of trips sorted by `booking_cutoff_time ASC`.
     - Displays Route name, Origin train arrival ID, Current bookings vs Threshold (e.g. `24/20`), Deadline countdown timer (e.g. `12m 45s left`), Quick CTA buttons: `[Quick Approve]` and `[Review Details]`.
  3. **`LiveTrainArrivalFeedWidget`:**
     - Stream of next 5 train arrivals at primary station hubs.
     - Shows Train Number, Origin, Scheduled vs Estimated Arrival Time, Delay Delta (`+14m` in warning red), Associated connecting feeder bus demand.
  4. **`FleetReadinessWidget`:**
     - Progress gauge of fleet readiness: Available vs Assigned vs In-Maintenance.

---

### Screen 3: Train Arrival Management & Intermodal Sync (`/trains`)
- **Purpose:** Monitor inbound train movements, identify train delay propagation, and synchronize feeder bus departure windows with passenger platform egress.
- **Layout:** Filter bar (Station, Train Line, Delay Status), Full-width Intermodal Synchronizer Table, Train-to-Trip Correlation Drawer.
- **Widgets:**
  1. **`StationSelectorTabs`:** Quick switch between regional rail terminals (e.g., Central Station, North Junction, South Metro).
  2. **`TrainArrivalTable`:**
     - Columns: Train #, Carrier, Origin, Scheduled Arrival, Estimated Arrival, Status (`ON_TIME`, `DELAYED`, `ARRIVED`, `CANCELLED`), Feeder Bus Demand Status, Actions.
  3. **`DelayImpactCalculator`:**
     - When a train is delayed $> 10$ minutes, displays calculated impact on connected feeder trips.
     - Offers one-click action: `[Delay Feeder Departure by +X min]` which updates passenger pickup times and broadcasts notifications.
  4. **`ArrivalDemandMiniBar`:**
     - Visual bar indicating what percentage of passengers on an inbound train have booked RailBus connections.

---

### Screen 4: Demand Monitoring & Aggregation Pipeline (`/demand`)
- **Purpose:** Deep dive into route-level and trip-level passenger booking aggregation prior to the 20-ticket threshold.
- **Layout:** Route selector sidebar, Demand matrix view, Real-time aggregation cards.
- **Widgets:**
  1. **`DemandProgressBarWidget`:**
     - Visual progress bar showing exact bookings:
       - Green fill: Confirmed & Paid bookings ($N$).
       - Dotted line: Threshold marker (e.g. $N=20$).
       - Yellow striped zone: Pending payment/cart reservations.
       - Subtext: `N / 20 confirmed (80% to threshold) • Cutoff in 42m`.
  2. **`DemandFilterBar`:**
     - Filter by: Route ID, Status (`Aggregating`, `Eligible`, `Threshold Missed`, `Approved`), Time Window.
  3. **`DemandVelocityChart` (Recharts):**
     - Booking velocity curve over time (bookings per 10-minute intervals leading up to T-cutoff).
  4. **`ThresholdWatchlist`:**
     - Trips hovering at 17–19 bookings nearing eligibility within the next 15 minutes.

---

### Screen 5: Trip Management & Approval Cockpit (`/trips` & `/trips/:id`)
- **Purpose:** The core decision center. Operators review trip economics, demand density, route geometry, and execute approval or rejection.
- **Layout:** Comprehensive table with filter chips, plus a dedicated Slide-over Details Drawer & Modal.
- **Widgets:**
  1. **`TripsDataTable`:**
     - Columns: Trip ID, Route Name, Scheduled Departure, Confirmed Demand / Threshold, Status Badge (`AGGREGATING`, `ELIGIBLE`, `APPROVED`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `REJECTED`, `CANCELLED`), Assigned Bus, Assigned Conductor, Actions.
  2. **`TripApprovalDrawer` / `Modal`:**
     - Triggered by clicking `[Review & Approve]`.
     - Displays:
       - Header: Trip Code, Route, Origin Hub $\rightarrow$ Destination Zones.
       - Passenger Demand Summary: Confirmed count, total fare revenue aggregate.
       - Connected Train: Train Number, platform arrival time, passenger transfer buffer (e.g., 14 mins).
       - Direct Approval CTA: `[Approve Trip & Proceed to Assignment]`.
       - Rejection Section: Rejection code dropdown (`INSUFFICIENT_FLEET`, `SEVERE_WEATHER`, `TRAIN_CANCELLED`, `CREW_UNAVAILABLE`, `MANUAL_OVERRIDE`), Reason text note, CTA: `[Reject Trip & Issue Refunds]`.
  3. **`TripStatusTimeline`:**
     - Visual audit trail: Created $\rightarrow$ Threshold Met $\rightarrow$ Approved by Operator $\rightarrow$ Assigned $\rightarrow$ Dispatched.

---

### Screen 6: Fleet Management & Bus Assignment (`/fleet`)
- **Purpose:** Manage bus inventory, monitor physical vehicle locations, and allocate buses to approved trips with automated conflict prevention.
- **Layout:** Fleet inventory grid / table, Bus availability calendar view, Assignment dialog.
- **Widgets:**
  1. **`BusRegistryTable`:**
     - Columns: Bus Plate / Unit Number, Model/Make, Seating Capacity (e.g. 32 seats), Fuel/EV Charge %, Accessibility (Wheelchair lift: Yes/No), Current Status (`AVAILABLE`, `ASSIGNED`, `MAINTENANCE`, `EN_ROUTE`), Current Assigned Trip, Depot Location.
  2. **`BusAssignmentModal`:**
     - Shows trip requirements: Minimum seats needed based on confirmed bookings (e.g. Needs $\ge 24$ seats).
     - Bus selection dropdown filtered strictly by:
       - Capacity $\ge$ Confirmed passengers.
       - Status = `AVAILABLE`.
       - No conflicting trip assignments within $T_{start} - 15m$ to $T_{end} + 15m$.
     - Conflict alert warning if operator attempts to force an unavailable vehicle.
  3. **`FleetUtilizationGauge`:**
     - Real-time gauge of active vs idle fleet capacity across regional depots.

---

### Screen 7: Conductor Management & Dispatch (`/conductors`)
- **Purpose:** Roster active conductors, check regulatory duty hour compliance, and assign crew to trips.
- **Layout:** Conductor roster cards, Shift timeline, Trip pairing selector.
- **Widgets:**
  1. **`ConductorRosterTable`:**
     - Columns: Conductor ID, Full Name, Contact Number, License / Badge ID, Shift Status (`ON_DUTY_AVAILABLE`, `ASSIGNED_ACTIVE`, `ON_BREAK`, `OFF_DUTY`), Active Trip ID, Total Hours Logged Today.
  2. **`ConductorAssignmentWidget`:**
     - Dropdown inside Trip Assignment workflow.
     - Filters conductors currently clocked in, within maximum daily driving/duty hours, and without overlapping trip assignments.
  3. **`DutyComplianceIndicator`:**
     - Warns dispatcher if assigning a conductor would push them past legal continuous duty hours ($> 4.5$ hours without break).

---

### Screen 8: Passenger Manifest & Boarding Oversight (`/trips/:id/manifest`)
- **Purpose:** Access passenger manifests for assigned and in-progress trips, track real-time boarding QR validation as conducted by the conductor.
- **Layout:** Trip header banner, Live Boarding Gauge, Searchable Manifest Table.
- **Widgets:**
  1. **`BoardingProgressMeter`:**
     - Live radial or horizontal meter: `18 of 24 Boarded (75%) • 6 Awaiting Boarding`.
  2. **`PassengerManifestTable`:**
     - Columns: Booking Reference, Passenger Name (redacted for privacy e.g. "J. Doe"), Seat/Ticket Type, Boarding Status (`AWAITING`, `BOARDED`, `NO_SHOW`, `CANCELLED`), Boarding Timestamp, Special Assistance Indicator (e.g., Wheelchair).
  3. **`ConductorCheckInStatus`:**
     - Shows when the assigned conductor started boarding validation on their mobile PWA.

---

### Screen 9: Operational Analytics & Reporting (`/analytics`)
- **Purpose:** Analytical evaluation of route performance, conversion rates, and revenue.
- **Widgets (Operational & High-Signal Only):**
  1. **`DemandConversionFunnelChart` (Recharts):**
     - Stages: Aggregating Trips $\rightarrow$ Threshold Met ($\ge 20$) $\rightarrow$ Operator Approved $\rightarrow$ Dispatched $\rightarrow$ Completed. Shows drop-off at each stage.
  2. **`RouteYieldHeatmapTable`:**
     - Routes ranked by average bookings per trip, demand consistency, and cancellation rate.
  3. **`PunctualityDistributionBarChart`:**
     - Feeder departure delay relative to train arrival (Distribution of departures in 0–5m, 5–10m, 10–15m, $>15m$).
  4. **`RevenueEstimatesSummary`:**
     - Calculated gross ticket yield versus estimated bus operational fuel/crew cost.

---

## 3. Operational User Journeys

### User Journey A: Routine Trip Approval & Dispatch (Happy Path)
1. **Notification Trigger:** Operator receives an audible chime and banner alert: `"Trip RB-402 (Central Station -> Silicon Park) reached 21/20 bookings. Eligible for review."`
2. **Access Queue:** Operator clicks notification or navigates to `/dashboard`. Trip `RB-402` appears at the top of the `EligibleTripsQueueWidget`.
3. **Inspect Trip:** Operator clicks `[Review]`. The `TripApprovalDrawer` opens:
   - Verifies train arrival: Train `IC-104` is running on time (Arrival: 14:15).
   - Feeder departure is scheduled for 14:30 (15-minute buffer).
   - Total confirmed passengers: 21. Route distance: 14 km.
4. **Approve:** Operator clicks `[Approve Trip]`. 
   - Backend sets status to `APPROVED`.
   - Drawer immediately transitions to the Assignment step.
5. **Assign Rolling Stock & Crew:**
   - Dropdown lists eligible buses: Bus `B-108` (32 seats, Available) is selected.
   - Dropdown lists eligible conductors: Conductor `David Miller` (On-Duty, 2.5h shift remaining) is selected.
   - Operator clicks `[Confirm Assignment & Dispatch]`.
6. **Confirmation:** Trip status becomes `ASSIGNED`. Conductor app receives manifest; passengers receive departure confirmation with gate/bay number.

---

### User Journey B: Train Delayed — Departure Hold Action
1. **Delay Alert:** Train `EXP-88` is reported delayed by 18 minutes.
2. **Impact Visibility:** Operator navigates to `/trains`. Trip `RB-505` (scheduled departure 16:00) is flagged with `Intermodal Misalignment: Train arriving 16:08`.
3. **Adjustment Action:** Operator clicks `[Adjust Feeder Schedule]`.
4. **Shift Departure:** Sets departure to 16:22 (giving 14 minutes egress).
5. **Broadcast:** System sends automated push/SMS to all 24 booked passengers and notifies assigned conductor.

---

### User Journey C: Threshold Unmet Rejection & Cancellation
1. **Cutoff Approaching:** Trip `RB-109` has only 11 confirmed bookings with 35 minutes until departure.
2. **Evaluation:** Dispatcher inspects demand velocity: no new bookings in 20 minutes.
3. **Manual Rejection / Auto-Cutoff:** At T-minus 30 minutes, trip is either auto-cancelled by backend or operator clicks `[Reject Trip]`.
4. **Reason Code:** Operator selects `INSUFFICIENT_DEMAND_THRESHOLD` and adds note `"Below 20-ticket threshold at T-30m"`.
5. **System Resolution:** Trip status updates to `REJECTED`. Backend automatically queues 11 full refunds and issues alternative transit recommendations to passengers.
