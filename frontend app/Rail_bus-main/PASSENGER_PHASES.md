# RailBus Passenger Application: Phased Implementation Plan & Scope Management

**Document ID:** `PASSENGER_PHASES`  
**Version:** 1.0  
**Context:** Rapid Hackathon Build Window with Strict Time Budget  
**Status:** Under Review (Awaiting User Sign-off)

---

## 1. Execution Strategy & Time Budget Allocation
RailBus must be delivered within a compressed hackathon timeline. To guarantee delivery of a fully functioning, installable PWA that strictly complies with the backend contract, development is organized into **seven sequential phases**.

Each phase produces a verifiable milestone. Development begins with an autonomous **Mock API Adapter** so the frontend team is never blocked waiting for backend deployments or database seeds.

```
+--------------------------------------------------------------------------------------------------+
| Phase 1: PWA Shell, Mock API Adapter, Design Tokens, Splash & Language (Est: 20%)                |
+--------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+--------------------------------------------------------------------------------------------------+
| Phase 2: Trip Registration, Available Buses & Seat Count Stepper (Est: 20%)                      |
+--------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+--------------------------------------------------------------------------------------------------+
| Phase 3: Upfront Payment Simulation & Idempotent Confirmation (Est: 15%)                         |
+--------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+--------------------------------------------------------------------------------------------------+
| Phase 4: Supabase Realtime Trip Demand & Status Transitions (Est: 15%)                           |
+--------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+--------------------------------------------------------------------------------------------------+
| Phase 5: Digital Ticket Pass, HMAC QR Rendering & Offline Vault (Est: 15%)                       |
+--------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+--------------------------------------------------------------------------------------------------+
| Phase 6: Cancellation, Alternatives & Booking History (Est: 10%)                                 |
+--------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+--------------------------------------------------------------------------------------------------+
| Phase 7: Lighthouse PWA Audit, Airplane Mode Verification & Final Polish (Est: 5%)               |
+--------------------------------------------------------------------------------------------------+
```

---

## 2. Phase-by-Phase Roadmap & Milestones

### Phase 1: PWA Shell, Mock Adapter & Foundational Setup
- **Objectives:** Establish the mobile-first shell, Vite PWA configuration, Stitch design tokens, and mock data engine.
- **Deliverables:**
  - Initialize Vite React + TypeScript project with Tailwind CSS configured with Stitch tokens (`#0B1F33`, `#F3F6FA`, `#F5A524`, `#0B7A55`).
  - Configure `vite-plugin-pwa` with `registerType: 'autoUpdate'`, manifest icons (192, 512, maskable), and standalone display.
  - Build Mock API Adapter in `/src/mocks/` with deterministic seed JSON (`routes.json`, `trains.json`, `trips.json`, `bookings.json`).
  - Implement 1.5-second lightweight Splash Screen (`/splash`) checking session and stored language.
  - Implement Language Selection Screen (`/language`) with bilingual parity (`en`, `kn`).
  - Implement persistent `TopBar`, `BottomNav` (4 tabs: Book, Schedules, Tickets, Account), and reactive `OfflineBanner`.
- **Milestone 1:** App shell opens on mobile viewport, toggles seamlessly between English and Kannada, and functions offline with mock seeds.

### Phase 2: Trip Registration & Bus Discovery Flow
- **Objectives:** Build the user funnel from train arrival selection to bus trip matching.
- **Deliverables:**
  - Implement Trip Registration form (`/book`): Train selector dropdown (`GET /trains`), arrival date picker, and destination stop selector (`GET /routes`).
  - Implement Available Buses listing (`/book/buses`): Filter chips (Best match, Earliest, Lowest fare), ranked trip cards displaying live progress bar (`"17 of 20 booked"`), fixed fare, and departure countdown.
  - Implement **Seat Count Stepper** (`/book/seats`): Replaces Stitch seat map with clean `[-] [ 2 ] [+]` counter (bounded 1 to 6) and transparent fare multiplier (`₹35 x 2 = ₹70`).
- **Milestone 2:** User can search a train, filter connecting feeder buses, and choose passenger seat count.

### Phase 3: Upfront Payment Simulation Pipeline
- **Objectives:** Implement the upfront payment flow that converts intent into confirmed demand.
- **Deliverables:**
  - Build Checkout Summary screen (`/book/pay`) showing clear upfront payment terms and automatic refund guarantee.
  - Implement client-side cryptographic UUID v4 idempotency key generator.
  - Implement isolated `PaymentSimulationModal` supporting `[Simulate Success]` vs `[Simulate Failure]`.
  - Wire `POST /payments/initiate` and `POST /payments/confirm`.
  - Implement retry handling that reuses the identical idempotency key on network failure.
- **Milestone 3:** User can simulate payment, receive confirmation, and observe booking status move from `PENDING_PAYMENT` to `CONFIRMED`.

### Phase 4: Supabase Realtime Demand & Status Transitions
- **Objectives:** Connect the frontend to live backend demand updates without HTTP polling.
- **Deliverables:**
  - Integrate `@supabase/supabase-js` realtime channel listener for PostgreSQL updates on table `trips`.
  - Hook demand updates into TanStack Query cache invalidation.
  - Implement reactive progress bar animation when demand ticks upward (e.g. 17 -> 18 -> 19 -> 20).
  - Implement status pill transition logic: `OPEN` -> `ELIGIBLE` -> `APPROVED` -> `ASSIGNED`.
- **Milestone 4:** Live demand counter updates in real time across browser windows when a new booking is simulated.

### Phase 5: Digital Ticket Pass & Offline IndexedDB Vault
- **Objectives:** Guarantee offline ticket presentation for conductor boarding.
- **Deliverables:**
  - Implement Your Ticket screen (`/tickets/:id`) rendering server-returned HMAC QR code using SVG QR canvas.
  - Display ticket code (`RB-MYS-88219`), passenger count, total fare, assigned bus number, and conductor name.
  - Save confirmed ticket and QR payload into IndexedDB (`idb-keyval`).
  - Implement offline inspection fallback: when offline, ticket displays `"Last verified by server at HH:MM"`.
  - Implement deferred PWA Install Banner (Chromium `beforeinstallprompt` + iOS Safari Share hint modal) triggered only after first confirmed booking.
- **Milestone 5:** Passenger can turn on Airplane Mode, reopen the app, and present their verified ticket and QR code to the conductor.

### Phase 6: Cancellation, Alternatives & Account Management
- **Objectives:** Handle booking lifecycle edge cases and post-booking flows.
- **Deliverables:**
  - Implement Booking Cancellation modal (`POST /bookings/{id}/cancel`) with clear refund confirmation notice.
  - Implement Alternative City Transit screen (`/alternatives`) shown when a trip is `REJECTED` or cancelled (KSRTC regular buses, auto-rickshaw stands).
  - Implement Booking History view under Tickets tab (`GET /bookings`).
  - Implement Account tab (`/account`) with profile view, language switcher, notification toggles, and logout.
- **Milestone 6:** Full trip lifecycle completed, including cancellations and alternative transport guidance.

### Phase 7: PWA Audit, Low-Bandwidth Testing & Final Polish
- **Objectives:** Validate performance, accessibility, and offline compliance.
- **Deliverables:**
  - Execute automated Lighthouse CI audit (target: Installable, >90 Performance, >95 Accessibility).
  - Conduct Airplane Mode regression suite: launch from cold start, inspect tickets, verify disabled booking actions.
  - Conduct slow 3G throttle testing: verify font loading and zero layout shifting (CLS < 0.05).
  - Verify complete Kannada translation coverage across all screens and error modals.
- **Milestone 7:** Final release build verified and approved for production deployment.

---

## 3. Strict Cut-Scope Priority List (Time Contingency)

If the build window is constricted or unexpected backend delays occur, features will be trimmed strictly in the following order to protect the core transit booking loop:

| Cut Priority | Feature / Module | Rationale for Cutting | Fallback Behavior if Cut |
| :--- | :--- | :--- | :--- |
| **Cut 1 (First to Go)** | **Interactive MapLibre Route Map** | Heavy bundle dependency (~180 KB), non-essential for initial booking. | Replace with static vertical stop timeline list showing stop names and travel minutes. |
| **Cut 2** | **Rich Notification Activity Center** | Separate notification screen requires additional endpoints. | Rely entirely on immediate floating UI toasts and status pills on the Ticket pass. |
| **Cut 3** | **Advanced Bus Filter Chips** | Sorting by "Lowest Fare" is redundant since fares are fixed (₹30-₹40). | Retain simple chronological listing sorted by departure time. |
| **Cut 4** | **Booking History Pagination** | Most passengers book 1-2 feeder trips per day. | Fetch recent 10 bookings without pagination. |
| **NEVER CUT (Core)** | **Seat Count Stepper (1-6)** | Essential to calculate total fare and register demand. | Must remain. |
| **NEVER CUT (Core)** | **Upfront Payment Simulation** | Master Index rule: demand is counted only after payment. | Must remain. |
| **NEVER CUT (Core)** | **Offline Ticket & HMAC QR in IDB** | Passenger must show ticket with no cell signal at the bus bay. | Non-negotiable core PWA feature. |
| **NEVER CUT (Core)** | **Bilingual Language Parity (EN/KN)** | Vital civic requirement for Mysuru commuters. | Non-negotiable core UX requirement. |
