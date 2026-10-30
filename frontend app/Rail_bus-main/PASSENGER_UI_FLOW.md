# RailBus Passenger Application: User Interface Flow & Screen Specifications

**Document ID:** `PASSENGER_UI_FLOW`  
**Version:** 1.0  
**Design System Reference:** Google Stitch Project `projects/13791182744985449940` (*Transit Wayfinding System*)  
**Status:** Under Review (Awaiting User Sign-off)

---

## 1. Design Language & Token Specifications
The visual language strictly follows the Google Stitch design tokens established for RailBus:
- **Canvas Base:** `#F3F6FA` (Cool slate, low-glare outdoor canvas)
- **Card / Surface Elevation:** `#FFFFFF` with `1px solid #D9E1EA` hairline border and `16px` radius (`rounded-2xl`)
- **Brand Navy (Text & Structure):** `#0B1F33` (High legibility, minimum 4.5:1 WCAG AA contrast)
- **Primary CTA Amber:** `#F5A524` (Paired strictly with `#0B1F33` text, min 52px touch target)
- **Success / Confirmed Green:** `#0B7A55` (Background pill: `#E6F4EA`, text: `#107C41`)
- **Warning / Demand Alert:** `#D32F2F` (Background pill: `#FDE8E8`, text: `#D32F2F`)
- **Typography:** Inter for Latin text and tabular numerals (`font-feature-settings: "tnum"`), Noto Sans Kannada for Kannada text.
- **Micro-Interactions:** 100ms–150ms mechanical ease transitions; zero bouncy or distracting animations.

---

## 2. Navigation Architecture & Global Shell

### 2.1 Top Application Bar
- **Height:** 56px fixed sticky header.
- **Left:** RailBus transit mark (geometric navy bus & rail track emblem) + "RailBus" logotype in `headline-sm` (18px/700).
- **Center:** Network Status Pill (renders only when offline or sync latency > 5s: `Offline (Showing Cached Data)`).
- **Right:**
  - **Language Selector:** Segmented toggle chip `[ EN | ಕನ್ನಡ ]`. Tapping immediately swaps language context across all active views without page reload.
  - **Profile Avatar:** 36px circular button navigating to the `Account` tab.

### 2.2 Bottom Tab Navigation
A fixed 64px bottom bar on mobile screens with 4 primary destinations (minimum 48px touch bounding box per tab):
1. **Book (`/`):** Trip search, train registration wizard, bus selection, seat count, and checkout.
2. **Schedules (`/schedules`):** Timetables of trains arriving at Mysuru Station and connected KSRTC bus route lines.
3. **Tickets (`/tickets`):** Active passenger tickets, offline QR presentation, and past trip history.
4. **Account (`/account`):** Profile details, language preferences, notification toggles, support contacts, and logout.

---

## 3. Stitch Screen Audit & Reconciliation Matrix

Each screen below is cross-referenced with Google Stitch Project `projects/13791182744985449940` and reconciled against the shared FastAPI backend contracts:

| Stitch Screen Title | Stitch Screen ID | Status Classification | Required Contract & UX Modifications |
| :--- | :--- | :--- | :--- |
| **1. Splash Screen** | `6f97fad243564e778259001584414579` | **Designed, matches contract** | 1.5-second session check route. Shows RailBus logo and KSRTC partnership subtext. Smoothly transitions to Language Selection (if first launch) or Book tab. |
| **2. Choose Language** | `6597a7347496460fac9ccf1fbef1f0ce` | **Designed, matches contract** | Displays dual high-contrast cards: English and ಕನ್ನಡ. Saves selection to `localStorage` pre-login. |
| **3. Login** | `9e4363448d8944388cd6aa4bce2cd91a` | **Designed, needs change** | **Contract Mismatch:** Stitch depicts mobile phone number entry. The backend OpenAPI contract exposes `POST /login` and `POST /register`. Needs UI form adaptation to support identifier/password or email authentication while flagging phone OTP as a backend requirement. |
| **4. Verify Code (OTP)** | `e478892722324b00a9d08fc453962adc` | **Designed, needs change** | **Backend Dependency:** Stitch has 6-digit OTP boxes. If Supabase Phone OTP is active, client uses Supabase Auth SDK; if custom FastAPI, endpoint `POST /auth/verify-otp` is needed. Keep UI modular. |
| **5. Register Your Trip**| `bb06808e00e7414491e7229d1b668505` | **Designed, matches contract** | Form inputs for Train Number (`GET /trains`), Arrival Date, Boarding Stop (Mysuru Railway Station), and Destination Drop-off Stop (`GET /routes`). |
| **6. Available Buses** | `ca866a48be884be1a1cfb64d10e1da85` | **Designed, matches contract** | Filter chips (Best Match, Earliest, Lowest Fare). Trip cards displaying live progress bars ("17 of 20 booked"), departure time, and destination. |
| **7. Choose Your Seats**| `6c7da395c9de48cd9915f1669a70dad3` | **Designed, needs change** | **Major Change:** The backend has 16 tables with **no seat-level data model**. The seat map layout in Stitch must be replaced with a **Seat Count Stepper** (1 to 6 seats). |
| **8. Pay for Your Seat** | `new_pay_screen` | **Designed, needs change** | **Major Copy Change:** The Stitch copy stated *"You pay only if the bus is confirmed"*. This is **invalidated** by the Master Index. New copy: *"Payment is completed now to confirm your demand toward the 20-passenger threshold. If the trip does not run, your payment will be fully refunded."* |
| **9. Your Ticket** | `354d79c94b1b47fcb4e4e4210f1d4651` | **Designed, matches contract** | Displays server-returned HMAC QR code, alphanumeric ticket code, fare paid, passenger name, route details, and offline badge (*"Last verified by server at HH:MM"*). |
| **10. Account** | `c8ed24b4e61a43c1a01a4cf7d8df170b` | **Designed, matches contract** | Profile summary, language preference toggle, notification settings, support contacts, and logout. |
| **11. Booking History** | *N/A (New)* | **Needs design** | Chronological list of past and upcoming bookings with status badges (`COMPLETED`, `CANCELLED`, `REJECTED`). |
| **12. Trip Details & Status** | *N/A (New)* | **Needs design** | Live demand monitor tracking the trip's transition through `OPEN` -> `ELIGIBLE` -> `APPROVED` -> `ASSIGNED`. |
| **13. Cancellation & Refund**| *N/A (New)* | **Needs design** | Confirmation modal/screen executing `POST /bookings/{id}/cancel` with clear policy explanation. |
| **14. Alternatives View**| *N/A (New)* | **Needs design** | Shown if a trip is `REJECTED` or cancelled. Offers KSRTC regular city bus schedules, auto-rickshaw stands, and taxi options. |
| **15. Route Map Explorer**| *N/A (New)* | **Needs design** | Interactive MapLibre view rendering the bus route polyline and stop markers between Mysuru Railway Station and destinations. |
| **16. Notification Center**| *N/A (New)* | **Needs design** | Activity feed displaying trip approval alerts, conductor assignments, and schedule updates. |

---

## 4. Trip Status Passenger Display Mapping
Per the Master Index, the trip status machine contains 7 statuses. Under no circumstances may the frontend display internal system codes or promise bus dispatch prematurely.

```
       [OPEN]               (Demand 0 to 19 confirmed bookings)
         |
         v (Demand >= 20 confirmed bookings)
     [ELIGIBLE]             (Threshold reached! Awaiting operator review)
      /      \
     v        v
[APPROVED]   [REJECTED]     (Operator assigns bus OR rejects due to fleet constraints)
    |            |
    v            v
[ASSIGNED]   [REFUNDED]     (Bus & conductor assigned -> Passenger alerted)
    |
    v
[DEPARTED]
    |
    v
[COMPLETED]
```

### Friendly Display Reference Table:
| Backend Status | Passenger-Facing Label (English) | Passenger-Facing Label (Kannada) | Badge Color / Icon | Contextual Helper Copy Shown to Passenger |
| :--- | :--- | :--- | :--- | :--- |
| `OPEN` | **Collecting Bookings** | **ಮುಂಗಡ ಕಾಯ್ದಿರಿಸಲಾಗುತ್ತಿದೆ** | `#EBF2FA` / `#0B1F33` (Clock) | `"{demand} of 20 confirmed bookings. Bus runs once threshold is met."` |
| `ELIGIBLE` | **Goal Reached - In Review** | **ಗುರಿ ತಲುಪಿದೆ - ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ** | `#FFF4E5` / `#B76E00` (Hourglass) | `"Threshold of 20 met! Waiting for KSRTC operator fleet approval."` |
| `APPROVED` | **Bus Confirmed!** | **ಬಸ್ ದೃಢೀಕರಿಸಲಾಗಿದೆ!** | `#E6F4EA` / `#0B7A55` (CheckCircle) | `"Trip approved by operator. Preparing vehicle assignment."` |
| `REJECTED` | **Trip Not Approved** | **ಟ್ರಿಪ್ ಅನುಮೋದಿಸಲಾಗಿಲ್ಲ** | `#FDE8E8` / `#D32F2F` (AlertTriangle) | `"Trip could not be scheduled. Full refund initiated. See alternatives below."` |
| `ASSIGNED` | **Bus & Driver Assigned** | **ಬಸ್ ಮತ್ತು ಚಾಲಕ ನಿಯೋಜಿಸಲಾಗಿದೆ** | `#E6F4EA` / `#0B7A55` (Bus) | `"Bus {bus_number} assigned. Conductor {conductor_name} ready at Bay {bay_no}."` |
| `DEPARTED` | **In Transit** | **ಪ್ರಯಾಣದಲ್ಲಿದೆ** | `#EBF2FA` / `#0B1F33` (Navigation) | `"Bus has departed Mysuru Station. Enjoy your ride."` |
| `COMPLETED` | **Trip Completed** | **ಪ್ರಯಾಣ ಪೂರ್ಣಗೊಂಡಿದೆ** | `#F3F6FA` / `#74777D` (Flag) | `"Arrived at destination. Thank you for using RailBus."` |

---

## 5. End-to-End User Journeys & State Transitions

### Journey 1: Trip Discovery, Registration & Checkout
```
+-------------------+      +-------------------+      +-------------------+
|  1. Splash & Auth | ---> |  2. Register Trip | ---> | 3. Available Buses|
|  - Check session  |      |  - Select Train   |      |  - Filter by match|
|  - Logged in user |      |  - Select Drop-off|      |  - See 17/20 bar  |
+-------------------+      +-------------------+      +-------------------+
                                                                |
                                                                v
+-------------------+      +-------------------+      +-------------------+
|   6. Your Ticket  | <--- |   5. Pay & Confirm| <--- | 4. Choose Seats   |
|  - HMAC QR code   |      |  - Sim payment    |      |  - Stepper [ - 2 +]|
|  - Cached offline |      |  - UUIDv4 Idemp.  |      |  - Fare: 2 x Rs.35|
+-------------------+      +-------------------+      +-------------------+
```

1. **Step 1: Train & Route Selection (`/book`):**
   - User inputs Train Number (e.g., `12007 Shatabdi Express`) and arrival date.
   - User selects Destination Stop (e.g., `Vijayanagar Water Tank`).
   - Clicks **"Find Matching Buses"** (CTA Amber button).

2. **Step 2: Available Buses (`/book/buses`):**
   - Displays ranked cards connecting directly with the train's scheduled arrival time (+15 to +35 min buffer).
   - Each card displays: Destination, Departure Time (e.g., `14:25`), Fixed Fare (e.g., `₹35`), Progress Bar (`17 of 20 booked`), and status pill (`Collecting Bookings`).
   - Cards with >=20 bookings show `Goal Reached - In Review` or `Bus Confirmed!`.

3. **Step 3: Seat Count Stepper (`/book/seats`):**
   - **Replaces Stitch seat map.**
   - Title: *"How many seats do you need?"*
   - Intuitive stepper control: `[-]  [ 2 ]  [+]` with range bounded between `1` and `6` seats.
   - Fare breakdown card: `2 Seats x ₹35 = ₹70 Total`.
   - Explanatory note: *"Seats are open-seating on KSRTC City Buses upon boarding."*

4. **Step 4: Upfront Payment Simulation (`/book/pay`):**
   - Summary card: Route, Scheduled Time, Total Fare (`₹70`).
   - Transparent disclaimer: *"Your payment confirms your booking and increments the trip demand counter. If the bus does not run, you will receive an immediate full refund."*
   - Payment Simulation Box:
     - Radio options: `[Simulate Payment Success]` vs `[Simulate Payment Failure]`.
     - Button: **"Pay ₹70 & Confirm Booking"**.
   - Submits `POST /payments/initiate` with a unique UUID v4 idempotency key, followed by `POST /payments/confirm`.

5. **Step 5: Ticket Issuance & Offline Vault Storage (`/tickets/:id`):**
   - Server returns confirmed booking record with HMAC-signed QR payload.
   - Application displays ticket view with QR, ticket code, trip metadata, and conductor instructions.
   - The ticket record is saved into IndexedDB (`idb-keyval`).
   - If first booking on an install-capable browser, displays non-intrusive Install Prompt banner.

---

### Journey 2: Demand Monitoring & Trip Status Transitions
1. **User views ticket or active booking in "Tickets" tab:**
   - Realtime connection listens to `trips` channel for updates on `selectedTripId`.
   - When total confirmed bookings reaches 20, the progress bar fills to 100% and status transitions from `Collecting Bookings` to `Goal Reached - In Review`.
   - When operator approves, status flips to `Bus Confirmed!` and notification toast is shown.
   - When bus and conductor are assigned, vehicle registration number (e.g., `KA-09-F-1234`) and conductor name appear directly on the digital pass.

---

### Journey 3: Cancellation & Alternative Transport Suggestions
1. **Passenger initiates cancellation (`/bookings/:id/cancel`):**
   - User taps **"Cancel Booking"** from Ticket options menu.
   - Confirmation dialog outlines refund rules: *"Full refund of ₹70 will be processed to your source account within 2-4 hours."*
   - Client sends `POST /bookings/{id}/cancel`.
   - Trip demand count decrements by the passenger's seat count. If trip was `ELIGIBLE` and drops below 20, trip status reverts to `OPEN`.
   - Ticket status updates to `CANCELLED`, QR code displays a diagonal cancellation watermark and barcode scanning is disabled.

2. **Trip Rejected by Operator (`/bookings/:id`):**
   - If trip reaches departure cutoff without 20 bookings, or if operator rejects due to vehicle shortage, trip status becomes `REJECTED`.
   - The ticket screen presents an informative red-tinted banner: *"This trip was not approved for departure. Your payment of ₹70 has been refunded in full."*
   - Prominent secondary button: **"View Alternative City Transit"**.
   - Navigates to `/alternatives`, showing:
     - Next scheduled standard KSRTC city bus lines from Mysuru Bus Stand (CBS).
     - Railway station prepaid auto-rickshaw booth location & estimated fares.
     - Direct dial link for local cab dispatch.

---

## 6. Offline Error States & Graceful Degradation

```
+-----------------------------------------------------------------------------------+
|  [!] Offline Mode - Showing cached ticket last verified at 14:10 today            |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   |                          RAILBUS DIGITAL PASS                             |   |
|   |                                                                           |   |
|   |                       [   HMAC QR CODE CANVAS   ]                         |   |
|   |                                                                           |   |
|   |   Ticket Code: RB-MYS-88219                       Seats: 2 Passengers     |   |
|   |   Route: Mysuru Station -> Vijayanagar            Fare Paid: Rs.70        |   |
|   |   Status: CONFIRMED BY SERVER                     Dep: 14:25 Today        |   |
|   +---------------------------------------------------------------------------+   |
|                                                                                   |
|   [ (Disabled) Modify Booking - Requires Active Internet Connection ]             |
+-----------------------------------------------------------------------------------+
```

1. **Active Offline Banner:**
   - Appears persistently at the top of the viewport whenever `navigator.onLine === false`.
   - Message: *"You are offline. Cached tickets remain valid for conductor boarding."*
2. **Action Disablement:**
   - Booking buttons ("Pay & Confirm", "Cancel Booking", "Search Buses") are visually dimmed (opacity 50%) and disabled with a tooltip explaining that internet connectivity is required.
3. **Staleness Badging:**
   - Demand counts show `"17 of 20 booked (Last updated at 13:45)"` to prevent misrepresenting stale cached figures as real-time metrics.
