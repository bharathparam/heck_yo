# RailBus Operator Dashboard — Frontend Architecture & Technical Design

**Document Version:** 1.0.0  
**Stack:** React 18+ / Vite / TypeScript / Tailwind CSS / React Router v6 / TanStack Query v5 / MapLibre GL / Recharts / Supabase Auth  
**Author:** Frontend Architect & Transport Operations Software Engineer  

---

## 1. Technical Stack & Architectural Principles

### 1.1 Core Technology Choices
- **Build Tool:** [Vite](https://vitejs.dev/) with SWC compiler for rapid HMR and optimized production bundles.
- **Framework & Language:** React 18+ with TypeScript in `strict: true` mode. Zero use of `any` types.
- **Routing:** React Router v6 with data loaders and nested layout guards (`ProtectedRoute`, `RoleGuard`).
- **Styling & Design System:** Tailwind CSS with custom design tokens tailored for high-density transit dispatch consoles (dark mode priority, high-contrast operational status tokens). Lucide React icons.
- **Server State & Caching:** [TanStack Query v5](https://tanstack.com/query/latest) (React Query) for request deduplication, cache invalidation, automated polling/backoff, and optimistic UI mutations.
- **Client & UI State:** Lightweight [Zustand](https://github.com/pmndrs/zustand) store for ephemeral UI states (sidebar collapse, active filter criteria, notification toasts, modal states).
- **Geospatial Mapping:** [MapLibre GL JS](https://maplibre.org/) with vector tiles for rendering train stations, bus stops, active vehicle telemetry, and route geometries with high frame rates ($60$ fps).
- **Data Visualization:** [Recharts](https://recharts.org/) for clear, operational metric charts (demand velocity, conversion funnels, delay distributions).
- **Authentication:** `@supabase/supabase-js` SDK interfacing with the shared Supabase project, handling JWT lifecycle, token refresh, and auth event listeners.

### 1.2 Core Architectural Principles
1. **Zero-Trust Client Validation:** The dashboard does not enforce business invariants as the single line of defense. The backend API is the ultimate enforcer of eligibility thresholds, permissions, and conflict prevention. The frontend presents user-friendly pre-validations and gracefully displays server rejection codes (`400`, `403`, `409`, `422`).
2. **Resilience in Loss of Connectivity:** Control rooms must never go blank on transient connection dips. TanStack Query caching provides stale-while-revalidate data with clear "Offline / Reconnecting" telemetry banners.
3. **Sub-second Operational Speed:** Keyboard shortcuts for frequent actions (e.g., `Alt + A` to approve, `Esc` to close drawer), compact table layouts, zero unnecessary blocking layout shifts.
4. **Strict Modular Isolation:** Separation between presentation components, domain-specific hooks, API data access services, and global layout shells.

---

## 2. Workspace & Codebase Directory Structure

```
AdminDashboard/
├── public/
│   ├── favicon.ico
│   ├── sounds/
│   │   ├── alert-threshold.mp3       # Chime when trip hits >=20 bookings
│   │   └── alert-delay.mp3           # Chime on major train delay (>15m)
│   └── tiles/                        # Fallback local map style definition
├── src/
│   ├── app/                          # Core app setup
│   │   ├── App.tsx                   # Root router provider & query client provider
│   │   ├── main.tsx                  # React DOM entry point
│   │   └── routes.tsx                # Centralized route definitions & lazy-loaded pages
│   ├── assets/                       # Static SVGs, logos, branding
│   ├── components/                   # Shared UI component library (Atomic / Primitive)
│   │   ├── ui/                       # Reusable primitives (buttons, inputs, modals, badges)
│   │   │   ├── Button.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Drawer.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Progress.tsx
│   │   │   ├── Tooltip.tsx
│   │   │   └── Dropdown.tsx
│   │   ├── feedback/                 # Feedback widgets
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── LoadingSkeleton.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── NetworkStatusBar.tsx
│   │   └── layout/                   # Layout wrappers
│   │       ├── AppLayout.tsx         # Main shell (Sidebar + Header + Body)
│   │       ├── Header.tsx            # Status indicator, clock, user profile menu
│   │       ├── Sidebar.tsx           # Navigation links with active count badges
│   │       └── PageHeader.tsx        # Breadcrumb, title, action slot
│   ├── features/                     # Domain modules (Feature-driven)
│   │   ├── auth/                     # Authentication & RBAC
│   │   │   ├── components/           # LoginForm, RoleIndicator
│   │   │   ├── hooks/                # useAuth, useSession
│   │   │   ├── guards/               # AuthGuard, RoleGuard
│   │   │   └── authService.ts        # Supabase auth methods
│   │   ├── dashboard/                # Main Overview
│   │   │   ├── components/           # KpiCards, EligibleTripsQueue, LiveTrainFeed
│   │   │   └── hooks/                # useDashboardMetrics
│   │   ├── trains/                   # Train Arrival Synchronization
│   │   │   ├── components/           # TrainArrivalTable, DelayImpactDrawer
│   │   │   └── hooks/                # useTrainArrivals, useIntermodalSync
│   │   ├── demand/                   # Demand Monitoring & Aggregation
│   │   │   ├── components/           # DemandProgressBar, ThresholdWatchlist, VelocityChart
│   │   │   └── hooks/                # useDemandMonitoring
│   │   ├── trips/                    # Trip Management, Approval & Rejection
│   │   │   ├── components/           # TripsTable, TripApprovalDrawer, RejectTripModal
│   │   │   ├── hooks/                # useTrips, useTripActions (approve, reject, cancel)
│   │   │   └── types/                # Trip, TripStatus, DemandInfo interfaces
│   │   ├── fleet/                    # Fleet & Bus Assignment
│   │   │   ├── components/           # BusRegistryTable, BusAssignmentDialog, FleetGauge
│   │   │   └── hooks/                # useBuses, useAssignBus
│   │   ├── conductors/               # Crew & Conductor Dispatch
│   │   │   ├── components/           # ConductorRosterTable, ConductorAssignDialog
│   │   │   └── hooks/                # useConductors, useAssignConductor
│   │   ├── manifest/                 # Passenger Manifest & Boarding
│   │   │   ├── components/           # ManifestTable, BoardingGauge
│   │   │   └── hooks/                # useTripManifest
│   │   ├── map/                      # Geospatial MapLibre Integration
│   │   │   ├── components/           # NetworkMap, VehicleMarker, RouteLayer
│   │   │   └── hooks/                # useMapLibre
│   │   └── analytics/                # Operational Analytics & Charts
│   │       ├── components/           # ConversionFunnel, RouteYieldChart, PunctualityChart
│   │       └── hooks/                # useAnalyticsData
│   ├── services/                     # Low-level infrastructure services
│   │   ├── api/                      # Axios / Fetch client configured with JWT interceptors
│   │   │   ├── client.ts             # Base client with auth token injection & error mapping
│   │   │   ├── endpoints.ts          # Strictly typed endpoint definitions
│   │   │   └── mocks/                # Comprehensive mock data for sandbox/dev testing
│   │   │       ├── mockDashboard.ts
│   │   │       ├── mockTrips.ts
│   │   │       ├── mockBuses.ts
│   │   │       └── mockConductors.ts
│   │   ├── realtime/                 # Supabase Realtime / WebSocket listeners
│   │   │   └── subscriptionManager.ts
│   │   └── supabase.ts               # Supabase JS client instance
│   ├── store/                        # Zustand UI stores
│   │   ├── useUiStore.ts             # Sidebar state, theme, audio alerts toggle
│   │   └── useNotificationStore.ts   # Operational notification queue
│   ├── types/                        # Global TypeScript definitions
│   │   ├── api.ts                    # Generic API response envelopes
│   │   └── models.ts                 # Bus, Conductor, Trip, Demand, Train interfaces
│   └── utils/                        # Pure utility functions
│       ├── formatters.ts             # Time, currency, distance formatters
│       ├── dateUtils.ts              # Relative countdowns, ETA calculators
│       └── conflictCheckers.ts       # Client-side validation helpers
```

---

## 3. Component Hierarchy & Flow Diagram

```
App
 └── QueryClientProvider
      └── AuthProvider (Supabase)
           └── BrowserRouter
                ├── Public Route: /login (LoginForm)
                └── ProtectedRoute (AuthGuard + RoleGuard)
                     └── AppLayout (Shell)
                          ├── Sidebar (Navigation links, pending action counters)
                          ├── Header (Realtime connection badge, sound toggle, operator profile)
                          ├── NetworkStatusBar (Offline / latency warnings)
                          └── Outlet (Active View)
                               ├── /dashboard ──► [KpiTelemetryGrid] + [EligibleTripsQueue] + [MiniNetworkMap]
                               ├── /trains    ──► [TrainArrivalTable] + [DelayImpactCalculator]
                               ├── /demand    ──► [DemandFilterBar] + [DemandGrid] + [VelocityChart]
                               ├── /trips     ──► [TripsTable] ──► [TripApprovalDrawer] ──► [AssignModal]
                               ├── /fleet     ──► [FleetReadinessGauge] + [BusRegistryTable]
                               ├── /conductors──► [ConductorRosterTable] + [DutyComplianceCard]
                               ├── /analytics ──► [ConversionFunnel] + [RouteYieldChart]
                               └── /trips/:id/manifest ──► [BoardingProgressMeter] + [ManifestTable]
```

---

## 4. State Management Architecture

### 4.1 Server State (TanStack Query v5)
- Server state is treated as cached snapshots of truth.
- **Cache Keys Design:**
  - `['operator', 'dashboard']` $\rightarrow$ Refreshed every 10 seconds or via WebSocket invalidation.
  - `['operator', 'trips', filters]` $\rightarrow$ Parameterized list with pagination and status filters.
  - `['trips', tripId, 'demand']` $\rightarrow$ Real-time demand queries for specific trips.
  - `['buses', { status: 'AVAILABLE' }]` $\rightarrow$ Bus fleet lookup.
  - `['conductors', { availableOnly: true }]` $\rightarrow$ Conductor crew lookup.
- **Optimistic Mutations:**
  - When an operator clicks `[Approve Trip]`, TanStack Query immediately applies an optimistic update to the cache, marking the trip `APPROVED` and moving it to the assignment queue. If the backend returns `409 Conflict` (e.g. threshold dropped below 20 or already approved by another dispatcher), the mutation rolls back and surfaces a modal toast.

### 4.2 Client Ephemeral State (Zustand)
- `useUiStore`:
  - `sidebarCollapsed: boolean`
  - `audioAlertsEnabled: boolean` (default: true for operator stations)
  - `selectedStationId: string | null`
  - `activeTripDrawerId: string | null`
- `useNotificationStore`:
  - Active operational alerts toast queue (threshold reached, train delays, bus breakdown alerts).

### 4.3 Real-Time Synchronization (Supabase Realtime / WebSocket)
- Operates on a hybrid model:
  1. **WebSocket / Supabase Realtime Channels:**
     - Channel `trips-channel`: Listens to `UPDATE` events on `trips` table. Triggers instant cache invalidation `queryClient.invalidateQueries({ queryKey: ['operator', 'trips'] })`.
     - Channel `demand-channel`: Listens to `INSERT` on `bookings` table. Updates demand progress bars without requiring full page refetch.
     - Channel `trains-channel`: Ingests train delay updates.
  2. **Fallback Polling:**
     - If the WebSocket drops, TanStack Query automatically falls back to standard HTTP polling every 15 seconds.

---

## 5. Map & Geospatial Architecture (MapLibre GL JS)

- **Vector Tiles & Basemap:** High-contrast dark transit basemap (e.g. Carto Dark Matter or custom vector style).
- **Layers & Sources:**
  1. `source: 'rail-corridor'`: Static GeoJSON linestring of the passenger rail line.
  2. `source: 'feeder-routes'`: GeoJSON multilinestrings for bus routes branching out from rail stations.
  3. `source: 'stations'`: Symbol layer with rail station icons.
  4. `source: 'buses-live'`: Point layer with dynamic vehicle orientation icons updated via vehicle GPS telemetry (in-progress trips).
  5. `source: 'demand-clusters'`: Visualized as colored heat pulses or catchment circles representing booking density at feeder drop-off zones.
- **Performance Optimization:**
  - Uses WebGL rendering; canvas is isolated in a memoized component `NetworkMap.tsx`.
  - Markers use canvas/SVG symbol layers rather than DOM elements to maintain smooth 60 FPS panning across large numbers of vehicles.

---

## 6. Resilience, Error Handling & Fallback Protocols

### 6.1 Granular Error Boundaries
- Each primary view and modal is wrapped in a React `ErrorBoundary`.
- A failure in the MapLibre canvas or Recharts component does not crash the operational table or approval buttons. An inline fallback card (`"Map rendering unavailable — operational tables remain functional"`) appears.

### 6.2 Network & API Degradation Protocol
- **Offline Detection:** An event listener on `window.navigator.onLine` toggles a high-priority warning header: `"OFFLINE MODE: Action disabled. Retrying connection..."`.
- **API Error Normalization:**
  - `401 Unauthorized` $\rightarrow$ Supabase session refresh attempted; if expired, redirects to `/login?session_expired=true`.
  - `403 Forbidden` $\rightarrow$ Rejection toast: `"Access Denied: Operator or Admin privileges required."`
  - `409 Conflict` $\rightarrow$ Specialized Conflict Modal: `"Resource State Changed: Trip was already assigned/cancelled by another operator. Refreshing view."`
  - `422 Unprocessable Entity` $\rightarrow$ Clear validation highlighting (e.g. `"Bus capacity (20) is lower than confirmed demand (24)"`).
  - `500 Internal Server Error` $\rightarrow$ Retry backoff with exponential delay (1s, 2s, 4s).

---

## 7. Security Architecture

1. **Token Authentication:**
   - Supabase Auth supplies a short-lived access JWT containing `user_id`, `email`, and custom app claims `app_metadata.role`.
   - The API client automatically attaches `Authorization: Bearer <token>` to all HTTP requests via an interceptor.
2. **Strict Server-Side Validation:**
   - The UI never assumes an action succeeded until confirmed by the server response.
   - Threshold counts, booking status transitions, and asset locks are evaluated strictly by PostgreSQL transactions on the shared backend.
3. **PII Masking:**
   - Passenger lists display anonymized or truncated customer identifiers (e.g., `M. Garcia - #BK-9021`) to comply with transit privacy regulations in control rooms visible to multiple staff members.
