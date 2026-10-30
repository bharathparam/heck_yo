# RailBus Passenger Application: System Architecture & Client-Side Design

**Document ID:** `PASSENGER_ARCHITECTURE`  
**Version:** 1.0  
**Target:** Mobile-First Progressive Web Application (PWA)  
**Authors:** Senior System Architect / Antigravity AI  
**Status:** Under Review (Awaiting User Sign-off)

---

## 1. Executive Summary & Core Mission
RailBus is a demand-responsive, scheduled public transit system operating from Mysuru Railway Station (MYS) in partnership with Karnataka State Road Transport Corporation (KSRTC). It bridges arriving rail passengers with guaranteed city connections by dynamically triggering fixed-fare feeder buses when a verified demand threshold of **20 confirmed, prepaid passengers** is achieved.

The Passenger Application is built as an installable, mobile-first Progressive Web App (PWA). It must deliver a deterministic, resilient transit booking experience capable of functioning on low-cost Android smartphones over intermittent 3G/4G connectivity, with zero tolerance for phantom bookings, stale demand metrics, or unverified tickets.

---

## 2. Guiding Architectural Principles
1. **Zero Client Trust:** The client never generates, signs, verifies, or modifies tickets, QR payloads, or payment statuses. All business truth originates exclusively from the FastAPI backend and PostgreSQL database.
2. **Upfront Payment Simplicity:** In alignment with Master Index rules, demand is counted only after successful payment confirmation. There is no complex two-phase hold-and-capture or card pre-authorization.
3. **Resilient Offline Utility:** The most critical transit artifact—the passenger's confirmed ticket with its HMAC-signed QR code—is cached locally upon receipt and remains viewable offline without a network connection.
4. **Honest Staleness Presentation:** Trip demand numbers and approval states are dynamic. The UI never masks network disconnection with cached demand counts; if offline, demand data is explicitly badged as `Last updated at HH:MM` and booking actions are safely disabled.
5. **Utilitarian Performance:** The bundle is strictly budget-constrained, loading minimal initial JS (<150 KB gzip), utilizing native CSS layout primitives, and lazily importing heavier dependencies such as MapLibre GL.

---

## 3. Technology Stack & Client Topology

```
+---------------------------------------------------------------------------------------------------------+
|                                    RailBus Mobile-First PWA (Vite + React)                              |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|   +-------------------------------------+   +-------------------------------------------------------+   |
|   |          UI & Presentation Layer    |   |                Routing & Navigation                   |   |
|   |  - Tailwind CSS (Stitch Tokens)     |   |  - React Router v6.28+ (Data Router)                  |   |
|   |  - Lucide Icons (2px stroke line)   |   |  - App BottomNav (Book, Schedules, Tickets, Account)  |   |
|   |  - MapLibre GL JS (Lazy loaded)     |   |  - Protected Route Guards (Supabase Auth Session)     |   |
|   +-------------------------------------+   +-------------------------------------------------------+   |
|                                                                                                         |
|   +-------------------------------------+   +-------------------------------------------------------+   |
|   |       State Management & Cache      |   |            Internationalization (i18n)                |   |
|   |  - TanStack Query v5 (Server State) |   |  - react-i18next + i18next-browser-languagedetector   |   |
|   |  - Zustand v5 (Ephemeral Client UI) |   |  - English (en) + Kannada (kn - Noto Sans Kannada)   |   |
|   |  - idb-keyval (Offline Ticket Vault)|   |  - Pre-login LocalStorage / Post-login Profile Sync   |   |
|   +-------------------------------------+   +-------------------------------------------------------+   |
|                                                                                                         |
|   +-------------------------------------------------------------------------------------------------+   |
|   |                                  Data Access & Transport Layer                                  |   |
|   |  - ApiClient: Fetch wrapper with JWT Bearer injection & UUID v4 Idempotency Key generator       |   |
|   |  - MockAdapter: In-memory simulation switchable via VITE_USE_MOCKS=true                          |   |
|   |  - Supabase Realtime Client: Postgres Changes on `trips` and `bookings` tables                  |   |
|   +-------------------------------------------------------------------------------------------------+   |
|                                                                                                         |
|   +-------------------------------------------------------------------------------------------------+   |
|   |                                 PWA & Service Worker Subsystem                                  |   |
|   |  - vite-plugin-pwa (Workbox autoUpdate)                                                         |   |
|   |  - Precache: App shell, fonts, static assets                                                    |   |
|   |  - Runtime Cache: Stale-While-Revalidate for static routes/stations                             |   |
|   |  - Blacklist: Strict Network-Only / No-Cache for /payments, /bookings POST, /login, /me         |   |
|   +-------------------------------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------------------------------+
                                                     |
                     +-------------------------------+-------------------------------+
                     | (REST over HTTPS)                                             | (WSS Realtime)
                     v                                                               v
      +-------------------------------+                               +-------------------------------+
      |   FastAPI Application Server  |                               |   Supabase Realtime Channel   |
      |   - 26 Endpoints              |                               |   - Trip Demand broadcast     |
      |   - HMAC QR Generator         |                               |   - Booking status changes    |
      |   - Payment Simulation Engine |                               |   - RLS JWT Security Filter   |
      +-------------------------------+                               +-------------------------------+
```

### 3.1 Stack Breakdown
- **Runtime & Build:** React 18.3+ with TypeScript 5.6+ bundled via Vite 5.4+.
- **CSS Architecture:** Tailwind CSS v3.4 configured with custom design tokens originating from the Google Stitch *Transit Wayfinding System* (`#0B1F33`, `#F3F6FA`, `#F5A524`, `#0B7A55`).
- **Routing:** React Router v6 with memory/browser routing, featuring route-level code splitting and an in-app 1.5-second session verification splash screen.
- **Server State & Data Synchronization:** TanStack Query (React Query) v5 for optimistic updates, cache invalidation, automated retry backoff, and network-status-aware queries.
- **Client UI State:** Zustand v5 for lightweight state (language preference, current stepper seat count, active route filters, install banner dismissal state).
- **Offline Persistence:** `idb-keyval` (lightweight IndexedDB wrapper) for storing server-verified tickets, QR payloads, and passenger booking history.
- **Geospatial Mapping:** MapLibre GL JS v4+ loaded dynamically on route details and station exploration views to prevent bloated initial chunks.
- **PWA Service Worker:** `vite-plugin-pwa` utilizing Workbox with declarative routing strategies.
- **Backend Communication:** Modular `ApiClient` with typed request/response contracts matching the FastAPI `/openapi.json` spec.

---

## 4. Directory & Module Structure

```
RailBus/
├── .agents/                      # Custom IDE rules and local configurations
├── public/                       # Static public assets
│   ├── icons/                    # PWA icons (192x192, 512x512, maskable)
│   ├── fonts/                    # Self-hosted Inter & Noto Sans Kannada webfonts
│   ├── favicon.svg               # Application brand favicon
│   └── robots.txt                # Search engine crawler policies
├── src/
│   ├── assets/                   # Brand SVGs, transit symbols, empty-state illustrations
│   ├── components/               # Atomic and molecular reusable UI components
│   │   ├── common/               # Button, Input, Modal, Badge, Toast, OfflineBanner
│   │   ├── navigation/           # TopBar, BottomNav, LanguageToggle
│   │   ├── booking/              # SeatStepper, DemandProgressBar, TripCard, BusFilterChips
│   │   ├── ticket/               # TicketQRRenderer, OfflineStatusPill, TicketDetailCard
│   │   └── map/                  # MapLibreCanvas, StopMarker, BusRoutePolyline
│   ├── config/                   # App constants, environment variable validation
│   ├── hooks/                    # Custom React hooks (usePWA, useNetworkStatus, useRealtimeTrip)
│   ├── i18n/                     # Internationalization configuration and locales
│   │   ├── locales/
│   │   │   ├── en.json           # English string dictionary
│   │   │   └── kn.json           # Kannada string dictionary
│   │   └── i18n.ts               # react-i18next setup and language detector
│   ├── mocks/                    # Mock API layer strictly isolated from production code
│   │   ├── data/                 # Deterministic mock JSON seeds (routes, trains, trips, bookings)
│   │   ├── mockApiClient.ts      # Mock adapter matching ApiClient contract
│   │   └── mockRealtime.ts       # Mock WebSocket/BroadcastChannel emulator for demo
│   ├── routes/                   # Page-level screen components
│   │   ├── SplashScreen.tsx
│   │   ├── LanguageSelectScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── TripRegistrationScreen.tsx
│   │   ├── AvailableBusesScreen.tsx
│   │   ├── SeatSelectionScreen.tsx
│   │   ├── PaymentScreen.tsx
│   │   ├── TicketScreen.tsx
│   │   ├── BookingHistoryScreen.tsx
│   │   ├── CancellationScreen.tsx
│   │   ├── RouteMapScreen.tsx
│   │   ├── NotificationsScreen.tsx
│   │   └── AccountScreen.tsx
│   ├── services/                 # API client, Supabase auth, storage, telemetry
│   │   ├── api.ts                # Unified API interface
│   │   ├── client.ts             # Production HTTP Fetch client
│   │   ├── supabase.ts           # Supabase client (JWT & Realtime)
│   │   ├── storage.ts            # LocalStorage & IndexedDB helpers
│   │   └── types.ts              # TypeScript models generated from OpenAPI
│   ├── store/                    # Zustand client state stores
│   │   ├── useUIStore.ts         # Modals, banners, notifications
│   │   ├── useBookingFlowStore.ts# Stepper count, selected trip, form inputs
│   │   └── useAuthStore.ts       # Session state, cached user metadata
│   ├── styles/                   # Global CSS & Tailwind utilities
│   │   ├── index.css             # Base reset, typography, transit tokens
│   │   └── components.css        # Card hairline boundaries & status pill styles
│   ├── App.tsx                   # Master App layout with TopBar, BottomNav, OfflineBanner
│   ├── main.tsx                  # Application bootstrap entry point
│   └── vite-env.d.ts             # Vite client types & PWA virtual modules
├── index.html                    # Root HTML template with viewport & meta tags
├── package.json                  # NPM dependencies and scripts
├── tailwind.config.ts            # Tailwind theme tokens mirroring Stitch design system
├── tsconfig.json                 # Strict TypeScript configuration
└── vite.config.ts                # Vite config with vite-plugin-pwa and build options
```

---

## 5. Client State Management Architecture

```
                                    +-----------------------------------------+
                                    |         User Interaction / Route        |
                                    +-----------------------------------------+
                                           |                           |
                    (Server Data Read / Mutate)             (UI / Form / Ephemeral)
                                           v                           v
                    +-----------------------------+         +-------------------------+
                    |     TanStack Query v5       |         |        Zustand v5       |
                    |  - ['trips', tripId]        |         |  - bookingCount (1..N)  |
                    |  - ['demand', tripId]       |         |  - activeFilters        |
                    |  - ['routes']               |         |  - languagePreference   |
                    |  - ['bookings', 'me']       |         |  - installBannerHidden  |
                    +-----------------------------+         +-------------------------+
                                   |                                     |
                       +-----------+-----------+                         |
                       |                       |                         |
              (Network Available)       (Network Down)                   |
                       v                       v                         |
            +---------------------+  +--------------------+              |
            | FastAPI Backend     |  | idb-keyval (IDB)   |              |
            | REST + Supabase WSS |  | - Confirmed Ticket |              |
            |                     |  | - Ticket QR HMAC   |              |
            +---------------------+  | - Booking Cache    |              |
                                     +--------------------+              |
                                               ^                         |
                                               | (Read Ticket Offline)   |
                                               +-------------------------+
```

### 5.1 Server State (TanStack Query)
- **Trips & Demand Cache:** Cache time (GC time) set to 5 minutes; stale time set to 15 seconds while online. Queries automatically poll or react to Supabase Realtime invalidation events.
- **Optimistic Booking Updates:** When `POST /payments/confirm` succeeds, the client immediately updates the local trip demand count by +N seats before background refetching occurs.
- **Offline Fallback Query Functions:** If network calls fail and the target is a confirmed ticket or booking history, TanStack Query queryFn falls back to reading `idb-keyval` ticket records.

### 5.2 Ephemeral Client State (Zustand)
- **`useBookingFlowStore`:** Tracks the current registration wizard step: `trainNumber`, `arrivalDate`, `boardingStopId`, `destinationStopId`, `selectedTripId`, and `seatCount` (1 to 6). This store survives page navigation but is cleared upon booking completion.
- **`useUIStore`:** Controls global toasts, the `beforeinstallprompt` banner status, network status detection, and modal sheets.

### 5.3 Offline Vault (`idb-keyval`)
- Stores verified JSON records for tickets:
  ```typescript
  interface CachedTicketRecord {
    bookingId: string;
    ticketId: string;
    tripId: string;
    qrPayload: string; // HMAC-signed string from server
    status: 'CONFIRMED' | 'BOARDED' | 'CANCELLED';
    passengerName: string;
    seatCount: number;
    farePaid: number;
    routeTitle: string;
    originStation: string;
    destinationStation: string;
    scheduledDeparture: string;
    lastVerifiedAt: string; // ISO 8601 server timestamp
  }
  ```

---

## 6. Authentication & Session Architecture
1. **Supabase Auth via FastAPI:** The application communicates with FastAPI endpoints (`/register`, `/login`, `/me`). 
2. **Token Storage:** The JWT access token is stored in memory (`useAuthStore`) with a secure fallback in a dedicated `sessionStorage` key. It is **never** placed in `localStorage` or Service Worker caches to protect against XSS token exfiltration.
3. **Role Enforcement:** All user roles (`passenger`, `conductor`, `operator`, `admin`) are embedded as claims in the Supabase JWT. While the UI conditionally renders tabs based on claims, the client architecture treats the frontend as inherently untrusted—every privileged API operation is strictly authorized on the backend.
4. **Session Expiry & Refresh:** If an API call receives a `401 Unauthorized`, an automated refresh cycle is triggered. If refresh fails, the client preserves the current route path, gently logs the user out, and redirects to `/login` with an informative toast.

---

## 7. Security & Compliance Architecture
- **Content Security Policy (CSP):** Strict script-src and connect-src policies restricting network traffic exclusively to the backend domain, Supabase Realtime endpoint, MapLibre tile CDN, and Google Fonts.
- **Zero Client-Side Ticket Signing:** Under no circumstances does the application generate QR codes from client state. It only feeds the server's signed string into the SVG QR rendering library (`qrcode.react`).
- **Payment Gateway Isolation:** The payment simulation component is decoupled via an abstract `PaymentGatewayAdapter` interface. When moving to a live production gateway (Razorpay or UPI intent deep-links), no booking or demand logic requires modification.
- **Audit Logging & Telemetry:** Offline errors and failed API mutations are buffered in memory and flushed to a lightweight client telemetry endpoint once connectivity is restored.
