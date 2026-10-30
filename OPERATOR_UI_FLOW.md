# RailBus Operator Dashboard — UI Flows, Wireframes & Interaction Specifications

**Document Version:** 1.0.0  
**Design System:** Transport Operations Ergonomics (High Data Density, Slate/Navy Palette, High-Contrast Status Accents)  
**Layout Model:** CSS Grid + Flexbox with collapsible navigation and sticky operational action headers  

---

## 1. Master Layout Architecture

The dashboard implements a three-tier layout optimized for command-and-control operations:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TOP APP BAR: [RailBus Logo] | [Live Time: 10:14:22] | [🟢 Realtime Connected] | [Profile/Role] │
├──────────────┬─────────────────────────────────────────────────────────────────────────┤
│ SIDEBAR      │ MAIN CONTENT VIEWPORT (Scrollable domain area)                           │
│              │                                                                         │
│ 📊 Overview  │ ┌─────────────────────────────────────────────────────────────────────┐ │
│ 🚆 Arrivals  │ │ SECTION HEADER: Breadcrumb + Action Controls + Quick Filter Bar     │ │
│ 📈 Demand    │ └─────────────────────────────────────────────────────────────────────┘ │
│ 🚌 Trips (6) │                                                                         │
│ 🚐 Fleet     │ ┌─────────────────────────────────────────────────────────────────────┐ │
│ 👮 Crew      │ │ PRIMARY WORKING AREA: Grids / Data Tables / Recharts / MapLibre     │ │
│ 📉 Analytics │ │                                                                     │ │
│              │ └─────────────────────────────────────────────────────────────────────┘ │
│ ⚙️ Settings  │                                                                         │
│ [Collapse <] │                                                                         │
├──────────────┴─────────────────────────────────────────────────────────────────────────┤
│ STATUS STRIP: Network Latency: 42ms | Active Trips: 14 | Fleet Idle: 12 | Urgent Alerts: 1 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Screen-by-Screen UI Specifications & Wireframes

### 2.1 Screen 1: Login & Role Selection (`/login`)

```
┌───────────────────────────────────────────────────┐
│                 [RAILBUS OPERATOR]                 │
│         Intermodal Transit Dispatch System         │
│                                                   │
│   ┌───────────────────────────────────────────┐   │
│   │ Work Email: [ dispatcher@railbus.org    ] │   │
│   │ Password:   [ ***********************   ] │   │
│   │                                           │   │
│   │ Select Role Profile:                      │   │
│   │ (o) Transit Operator   ( ) Ops Admin      │   │
│   │                                           │   │
│   │ [  Sign In to Control Center  ]          │   │
│   └───────────────────────────────────────────┘   │
│                                                   │
│   Secure Supabase Auth • TLS 1.3 • Zero-Trust RBAC │
└───────────────────────────────────────────────────┘
```
- **Error States:** Bad credentials triggers inline shaking input border in red (`#EF4444`) with message: `"Invalid email or password"`.
- **Session Expiry:** Redirecting users with `?reason=session_expired` renders an informational banner: `"Your session timed out after 30 minutes of inactivity. Please sign in again."`

---

### 2.2 Screen 2: Operations Command Center (`/dashboard`)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ TELEMETRY METRIC CARDS (7 Primary Indicators)                                                  │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────┐│
│ │ TOTAL BOOKED │ │ CONFIRMED    │ │ ⚠️ ELIGIBLE  │ │ APPROVED     │ │ IN PROGRESS  │ │ BUSES ││
│ │   842 pax    │ │   765 pax    │ │   6 TRIPS    │ │   8 TRIPS    │ │   5 TRIPS    │ │ 12 IDL││
│ │ +12% vs yday │ │ 90.8% paid   │ │ [ACT NOW]    │ │ Pending Asgn │ │ On Road      │ │ 4 Mnt ││
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └───────┘│
├───────────────────────────────────────────────────┬────────────────────────────────────────────┤
│ ACTION REQUIRED: ELIGIBLE TRIPS QUEUE (Demand>=20)│ LIVE MAP & TRAIN ARRIVAL FEED              │
│                                                   │                                            │
│ [Trip RB-402] Central -> Silicon Park             │ 🚆 EXP-104 (North)  ETA: 10:00 (On Time)   │
│ 👥 22/20 confirmed [██████████░] 110%             │ 🚆 IC-88   (South)  ETA: 10:14 (+14m DLY) ⚠️│
│ ⏱️ Cutoff: 14 mins remaining                      │                                            │
│ [Quick Approve]  [Review Details]                 │ ┌────────────────────────────────────────┐ │
│ ───────────────────────────────────────────────── │ │ MAPLIBRE GL NETWORK CANVAS            │ │
│ [Trip RB-407] Central -> West Valley              │ │ • Live vehicle markers (moving)        │ │
│ 👥 20/20 confirmed [██████████] 100%              │ │ • Feeder route corridor geometries     │ │
│ ⏱️ Cutoff: 21 mins remaining                      │ │ • Terminal station icons               │ │
│ [Quick Approve]  [Review Details]                 │ └────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┴────────────────────────────────────────────┘
```

---

### 2.3 Screen 3: Train Arrival Management (`/trains`)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Train Arrivals & Intermodal Feeder Synchronization                                             │
│ Station: [All Stations ▼] | Status: [All ▼] | Search: [Train # or Origin...      ]             │
├─────────┬──────────────┬────────────┬────────────┬─────────────┬──────────────┬────────────────┤
│ TRAIN # │ CARRIER      │ ORIGIN     │ SCHED. ETA │ ESTIMATED   │ STATUS       │ FEEDER DEMAND  │
├─────────┼──────────────┼────────────┼────────────┼─────────────┼──────────────┼────────────────┤
│ IC-104  │ NationalRail │ North Hub  │ 10:00      │ 10:00       │ 🟢 On Time   │ 2 Trips (44 pax│
│ EXP-88  │ ExpressLines │ Capital    │ 10:15      │ 10:33 (+18m)│ 🔴 Delayed   │ 1 Trip (22 pax)│
│ REG-12  │ MetroRail    │ Airport    │ 10:30      │ 10:30       │ 🟢 On Time   │ 1 Trip (18 pax)│
└─────────┴──────────────┴────────────┴────────────┴─────────────┴──────────────┴────────────────┘
```
- **Interaction (Delay Drawer):** Clicking on delayed row `EXP-88` opens the **Delay Impact Drawer**:
  - Highlights connected Trip `RB-505`.
  - Displays original feeder departure: `10:30` (only 3 mins after delayed train arrival).
  - Offers one-click action: `[Delay Feeder Departure to 10:48 (+18m Buffer)]`.
  - Confirmation triggers passenger and conductor SMS push notifications.

---

### 2.4 Screen 4: Demand Aggregation & Trip Pipeline (`/demand`)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Route Demand Aggregation & Threshold Monitor                                                   │
│ Filter: [All Routes ▼] | [Show Approaching Cutoff Only ☐] | Search: [Trip ID...       ]        │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│ TRIP RB-402 • Central Hub -> Silicon Park Zone B                                              │
│ Departure: 10:15 (T-30m) • Train: IC-104 (10:00)                                              │
│ Confirmed Bookings: 22 / 20 threshold                                                          │
│ [██████████████████████████████████████████████████████████░░░░] 110% of threshold             │
│ Status: [ ELIGIBLE ] • Cutoff: 09:45 (12m left)                                                │
│ Action: [ Approve Trip ]  [ Reject Trip ]                                                      │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│ TRIP RB-408 • Central Hub -> Lake District                                                     │
│ Departure: 10:45 (T-60m) • Train: REG-12 (10:30)                                               │
│ Confirmed Bookings: 14 / 20 threshold                                                          │
│ [█████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 70% of threshold              │
│ Status: [ AGGREGATING ] • Cutoff: 10:15 (42m left)                                             │
│ Action: [ Button Disabled: 6 more bookings needed for eligibility ]                           │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.5 Screen 5: Trip Approval, Rejection & Assignment Drawer Flow

```
STEP 1: REVIEW TRIP DEMAND               STEP 2: ALLOCATE FLEET & CREW
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Review Trip RB-402                   │ │ Assign Bus & Conductor: RB-402       │
│ Route: Central -> Silicon Park       │ │ 👥 Confirmed Demand: 22 Passengers   │
│                                      │ │                                      │
│ Demand Status:                       │ │ Select Vehicle:                      │
│ • 22 Confirmed & Paid Bookings       │ │ [ Bus BUS-07 (Volvo 9400 - 32 Seats) ]
│ • Threshold: 20 met (110%)           │ │ 🟢 Available at Central Depot Bay 4  │
│ • Est. Revenue: $330.00              │ │                                      │
│                                      │ │ Select Conductor:                    │
│ Connected Rail Service:              │ │ [ Marcus Vance (Badge: CND-992)      ]
│ • Train IC-104 (On Time - ETA 10:00) │ │ 🟢 On Duty • 3.5 hrs worked today    │
│ • Egress Buffer: 15 minutes          │ │                                      │
│                                      │ │ [x] Notify conductor immediately     │
│ [ Reject Trip... ]  [ Approve Trip ] │ │                                      │
│                                      │ │ [ Back ]   [ Complete Assignment ]   │
└──────────────────────────────────────┘ └──────────────────────────────────────┘
```

- **Rejection Modal (when `[Reject Trip...]` clicked):**
  - Requires selecting standard reason code:
    - `INSUFFICIENT_FLEET`
    - `CREW_UNAVAILABLE`
    - `TRAIN_CANCELLED`
    - `SEVERE_WEATHER`
  - Input field for mandatory audit note.
  - Red Confirmation CTA: `[Confirm Rejection & Issue Full Refunds]`.

---

### 2.6 Screen 6: Fleet Management & Rolling Stock (`/fleet`)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Fleet Inventory & Bus Allocation                                                               │
│ Status Filter: [All (18) ▼] [Available (12)] [Assigned (4)] [Maintenance (2)]                  │
├─────────┬──────────────────┬──────────┬───────────┬─────────────┬──────────────┬───────────────┤
│ BUS ID  │ MAKE / MODEL     │ CAPACITY │ WHEELCHAIR│ BATTERY/FUEL│ CURRENT TRIP │ STATUS        │
├─────────┼──────────────────┼──────────┼───────────┼─────────────┼──────────────┼───────────────┤
│ BUS-01  │ BYD K9 Electric  │ 28 Seats │ ♿ Yes    │ 🔋 94%      │ —            │ 🟢 Available  │
│ BUS-07  │ Volvo 9400 B8R   │ 32 Seats │ ♿ Yes    │ ⛽ 88%      │ RB-402       │ 🔵 Assigned   │
│ BUS-14  │ Mercedes Citaro  │ 40 Seats │ ♿ Yes    │ ⛽ 65%      │ RB-389       │ 🟣 En Route   │
│ BUS-18  │ Scania Citywide  │ 32 Seats │ ❌ No     │ ⛽ 15%      │ —            │ 🟠 Maintenance│
└─────────┴──────────────────┴──────────┴───────────┴─────────────┴──────────────┴───────────────┘
```

---

### 2.7 Screen 7: Conductor Management & Duty Compliance (`/conductors`)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Conductor Crew Roster & Duty Compliance                                                        │
├────────┬──────────────────┬───────────┬──────────────┬──────────────┬────────────┬─────────────┤
│ BADGE  │ NAME             │ PHONE     │ SHIFT WINDOW │ DUTY TODAY   │ TRIP ASGN  │ STATUS      │
├────────┼──────────────────┼───────────┼──────────────┼──────────────┼────────────┼─────────────┤
│ CND-992│ Marcus Vance     │ 555-019-28│ 06:00 - 14:00│ 3.5 / 8.0 hrs│ RB-402     │ 🔵 Assigned │
│ CND-110│ Elena Rostova    │ 555-019-88│ 08:00 - 16:00│ 1.5 / 8.0 hrs│ —          │ 🟢 Available│
│ CND-404│ Jamal Washington │ 555-019-34│ 12:00 - 20:00│ 0.0 / 8.0 hrs│ —          │ ⚪ Clock-in │
└────────┴──────────────────┴───────────┴──────────────┴──────────────┴────────────┴─────────────┘
```

---

### 2.8 Screen 8: Passenger Manifest & Boarding Oversight (`/trips/:id/manifest`)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Trip RB-402 — Passenger Manifest & Boarding Validation                                         │
│ Assigned Bus: BUS-07 (Volvo 9400) | Conductor: Marcus Vance (CND-992)                          │
│                                                                                                │
│ BOARDING PROGRESS: 18 / 22 Boarded (81.8%)                                                    │
│ [██████████████████████████████████████████████████████████████░░░░░░░░░░░░]                   │
│                                                                                                │
│ Search Passenger: [ Enter reference or name...                   ]                             │
├──────────────┬──────────────────┬──────────┬──────────────┬──────────────┬─────────────────────┤
│ BOOKING REF  │ PASSENGER        │ SEAT     │ SPECIAL REQ  │ STATUS       │ SCANNED AT          │
├──────────────┼──────────────────┼──────────┼──────────────┼──────────────┼─────────────────────┤
│ BK-9021      │ S. K.            │ Seat 04  │ Standard     │ 🟢 BOARDED   │ 10:08:12            │
│ BK-9022      │ R. M.            │ Seat 01  │ ♿ Wheelchair│ 🟢 BOARDED   │ 10:09:44            │
│ BK-9029      │ J. T.            │ Seat 12  │ Standard     │ 🟡 AWAITING  │ —                   │
│ BK-9033      │ L. D.            │ Seat 18  │ Standard     │ 🔴 NO SHOW   │ —                   │
└──────────────┴──────────────────┴──────────┴──────────────┴──────────────┴─────────────────────┘
```

---

### 2.9 Screen 9: Operational Analytics & Route Economics (`/analytics`)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Operational Performance & Yield Analytics                                                      │
├───────────────────────────────────────────────┬────────────────────────────────────────────────┤
│ DEMAND-TO-DISPATCH CONVERSION FUNNEL          │ ROUTE PASSENGER YIELD (Avg Pax / Trip)         │
│                                               │                                                │
│ Aggregating Trips:   120  (100%)              │ Central -> Silicon Park   [████████████] 26.4  │
│ Reached Threshold:   96   (80%)               │ Central -> Medical City   [██████████]   22.1  │
│ Operator Approved:   92   (76.6%)             │ Central -> East Suburbs   [████████]     18.2  │
│ Successfully Run:    90   (75.0%)             │                                                │
├───────────────────────────────────────────────┴────────────────────────────────────────────────┤
│ PUNCTUALITY & TRANSFER WINDOW (Feeder Departure Delay vs Train Arrival)                        │
│ [ Recharts Bar Chart: Departure within 0-5m (62%) | 5-10m (28%) | >10m (10%) ]                │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Interaction States & Edge Case UI Treatments

### 3.1 Skeleton & Loading States
All tables, KPI cards, and charts display animated pulse skeletons during asynchronous data fetches rather than generic full-screen loading spinners.

### 3.2 Empty States
When filters return no rows (e.g. no trips with status `ELIGIBLE`), a clean illustration with descriptive text and an action reset button is displayed:
> *"No trips currently require review. All aggregating trips are below threshold or already assigned."*

### 3.3 Conflict Resolution Modal
If two operators attempt to assign the same bus simultaneously:
- The second submission receives a `409 Conflict`.
- A warning dialog pops up:
  > *"Assignment Conflict: Bus BUS-07 was just assigned to Trip RB-398 by Dispatcher Marcus. Please choose another vehicle."*
- The vehicle selector automatically refreshes.
