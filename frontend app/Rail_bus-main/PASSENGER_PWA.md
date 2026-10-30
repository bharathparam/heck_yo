# RailBus Passenger Application: Progressive Web Application (PWA) Specification

**Document ID:** `PASSENGER_PWA`  
**Version:** 1.0  
**Build Tool:** `vite-plugin-pwa` (Workbox)  
**Status:** Under Review (Awaiting User Sign-off)

---

## 1. Overview & PWA Strategic Objective
RailBus serves transit passengers who frequently navigate areas with inconsistent cellular coverage—including railway platforms, basement transit tunnels, and rural bus routes. 

The application is architected as an installable, mobile-first Progressive Web App (PWA) with two non-negotiable operational requirements:
1. **Offline Ticket Availability:** A passenger must be able to open the app and present their confirmed ticket and HMAC QR code to the bus conductor with zero cellular signal.
2. **Deterministic Data Integrity:** The app must never present stale demand figures as live data, must never cache sensitive auth tokens or payment mutations, and must never disrupt an in-progress booking with an unexpected app reload.

---

## 2. Web App Manifest Specification

The web manifest is defined in `vite.config.ts` via `VitePWA` options and output to `/manifest.webmanifest`:

```json
{
  "name": "RailBus - Mysuru Feeder Transit",
  "short_name": "RailBus",
  "description": "Demand-triggered KSRTC feeder bus booking from Mysuru Railway Station.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#0B1F33",
  "background_color": "#F3F6FA",
  "lang": "en-IN",
  "categories": ["travel", "transit", "utilities"],
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-maskable-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/icon-maskable-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

---

## 3. Service Worker Strategy & Workbox Caching Matrix

The Service Worker is managed exclusively via `vite-plugin-pwa` with `registerType: 'autoUpdate'`. Hand-written service workers are strictly prohibited to avoid cache versioning bugs and registration race conditions.

```
+----------------------------------------------------------------------------------------------------------+
|                                        Workbox Request Interception                                      |
+----------------------------------------------------------------------------------------------------------+
       |                                       |                                    |
(App Shell / Static)              (Reference Data / Routes)                (Dynamic / Transactions)
       |                                       |                                    |
       v                                       v                                    v
+--------------------+             +------------------------+             +--------------------+
|    Precache /      |             |  Stale-While-Revalidate|             |    Network Only    |
| CacheFirst (30d)   |             |  (24-Hour Max Age)     |             |    (Zero Cache)    |
| - index.html       |             | - /trains              |             | - /payments/*      |
| - JS & CSS bundles |             | - /routes              |             | - /bookings (POST) |
| - Inter & Kannada  |             | - /routes/:id          |             | - /login, /me      |
|   webfonts         |             | - Station geo data     |             | - Realtime WSS     |
+--------------------+             +------------------------+             +--------------------+
```

### Comprehensive Caching Architecture Table:

| Resource Type | Matching Pattern / URL | Workbox Strategy | Expiration / Max Age | Justification & Offline Handling |
| :--- | :--- | :--- | :--- | :--- |
| **App Shell** | `index.html`, `assets/*.js`, `assets/*.css`, SVG icons | **Precache (CacheFirst)** | Infinite until new revision hash | Enables immediate app launch even in airplane mode. Handled automatically by Vite build hash injection. |
| **Web Fonts** | Google Fonts / Self-hosted (`*.woff2`) | **CacheFirst** | 365 Days | Eliminates layout jitter and typography flash (FOUT/FOIT) under slow 3G/2G connections. |
| **Static Transit Data** | `GET /trains`, `GET /routes`, `GET /routes/*` | **Stale-While-Revalidate** | 24 Hours (Max 50 entries) | Routes and train timetables change infrequently. Allows passengers to browse stops offline. Background fetch updates data. |
| **Trip Demand Counts** | `GET /trips/*/demand`, `GET /trips` | **NetworkOnly** | **Zero (Never Cached)** | **Critical Safety Rule:** Trip demand and approval status are volatile. Serving stale demand numbers could mislead passengers into expecting a bus. If network is offline, UI shows cached data with explicit tag: `"Last updated at HH:MM"`. |
| **Passenger's Tickets** | `GET /bookings/:id` | **NetworkFirst -> IndexedDB** | Manual invalidation | **Most Critical Offline Asset.** Ticket payload and HMAC QR are saved into IndexedDB upon successful booking. Rendered offline with badge: `"Last verified by server at HH:MM"`. |
| **Payment Operations** | `POST /payments/initiate`, `POST /payments/confirm` | **NetworkOnly (Blacklisted)** | **Never Cached** | **Financial Integrity:** Payment attempts must never be fulfilled from cache or replayed by service worker background sync without explicit user action. |
| **Auth & Credentials**| `POST /login`, `POST /register`, `GET /me` | **NetworkOnly (Blacklisted)** | **Never Cached** | **Security Rule:** Tokens and authentication responses must never reside in Workbox cache storage. |

---

## 4. Install Prompt UX & Platform Handling

### 4.1 Chromium / Android (`beforeinstallprompt`)
Prompting the user immediately upon opening the app produces high dismissal rates and frustrates commuters. RailBus follows a high-intent, value-proven installation model:
1. When the browser fires `window.addEventListener('beforeinstallprompt', e)`, the application intercepts and stores the event object in memory (`useUIStore`).
2. The install banner is **suppressed** during first launch, registration, and payment.
3. Once the passenger **completes their first confirmed booking** and lands on `/tickets/:id`, a clean, dismissible banner slides in above the bottom navigation:
   > **Install RailBus for Offline Tickets**  
   > *Keep your bus ticket accessible at the station even without mobile signal.*  
   > `[ Install App ]`   `[ Not Now ]`
4. If dismissed, the choice is saved in `localStorage`, and the banner will not re-appear for 14 days.

### 4.2 iOS Safari & iPadOS
Safari does not support the `beforeinstallprompt` event or automatic install banners:
1. The app detects iOS Safari (`navigator.userAgent` and `navigator.standalone === false`).
2. After the first successful booking, a lightweight educational modal is displayed:
   > **Add Ticket to Home Screen**  
   > *To open your ticket at the bus bay without mobile data:*  
   > 1. Tap the **Share** button in Safari's bottom toolbar (`square.and.arrow.up`).  
   > 2. Scroll down and select **"Add to Home Screen"**.

---

## 5. Seamless Application Update Flow
With `registerType: 'autoUpdate'`, Workbox monitors new build assets every time the page is navigated or after network reconnection.

### The In-Flight Protection Constraint:
A silent background reload could erase a user's form inputs or corrupt an active payment simulation. Therefore:
1. When `needRefresh` is triggered by the service worker virtual module (`virtual:pwa-register`), the app inspects the current route:
   - If user is on `/book/pay` or submitting `/book/seats`, the update prompt is **deferred**.
   - If user is on an informational screen (`/schedules`, `/account`, `/tickets`), a floating toast is displayed:
     > **Update Available**  
     > *A new version of RailBus is ready.*  
     > `[ Refresh Now ]`
2. Clicking **Refresh Now** invokes `updateServiceWorker(true)`, cleanly swapping caches and reloading to the newest version.

---

## 6. Offline UX & Error Boundary Behavior

```typescript
// Component: OfflineBanner.tsx
export const OfflineBanner: React.FC = () => {
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div 
      role="status" 
      aria-live="polite"
      className="bg-[#0B1F33] text-[#F3F6FA] px-4 py-2 text-xs flex items-center justify-between border-b border-[#D9E1EA]"
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#F5A524] animate-pulse" />
        <span>Offline Mode — Showing saved tickets and schedules.</span>
      </div>
      <span className="text-[10px] text-[#A0B0C0]">Actions limited</span>
    </div>
  );
};
```

### Action Guarding
- **Booking & Payment:** The "Proceed to Payment" and "Simulate Payment" buttons are disabled with descriptive copy: *"Internet required to reserve demand on live buses"*.
- **Cached Tickets:** Accessible through the bottom "Tickets" tab, reading directly from IndexedDB without network delay. The digital pass displays: *"Last verified by server at 14:15"*.

---

## 7. Push Notifications & Future Web Push Integration
1. **MVP Phase (In-App & Realtime First):**
   - Push notifications are designated as a post-hackathon enhancement.
   - All immediate notification needs (trip threshold reached, bus approved, conductor assigned) are fulfilled using **Supabase Realtime WSS channels** and presented via in-app toast banners and the `/notifications` activity feed.
2. **Phase 2 Web Push Considerations:**
   - Apple Web Push requires iOS 16.4+ and only operates after the user has explicitly added the PWA to their Home Screen.
   - VAPID keys and notification permission requests will be isolated behind an opt-in toggle inside the Account settings screen.

---

## 8. Splash Screen Flow
1. **Native OS Manifest Splash:** Generated automatically by the mobile OS using `background_color: "#F3F6FA"`, `theme_color: "#0B1F33"`, and the 512px icon.
2. **In-App Splash Route (`/splash`):** A lightweight React route rendering for ~1.5 seconds. During this window, it checks:
   - Supabase session validity (`useAuthStore`).
   - Saved language preference (`i18n`).
   - IndexedDB ticket vault freshness.
3. Smoothly redirects to `/` (Trip Registration) if authenticated, or `/language` if first-time user.

---

## 9. Lighthouse PWA & Performance Budgets

Target device profile: **Budget Android Smartphone (e.g. MediaTek Helio G35, 3GB RAM) over Simulated Slow 4G / Weak 3G Connection**.

| Lighthouse Audit Category | Target Score | Budget Constraint |
| :--- | :--- | :--- |
| **Progressive Web App** | **Installable (Pass)** | Manifest valid, Service Worker registered, Maskable icon present, HTTPS enforced. |
| **Performance** | **> 90 / 100** | First Contentful Paint (FCP) < 1.8s; Largest Contentful Paint (LCP) < 2.5s; Cumulative Layout Shift (CLS) < 0.05. |
| **Accessibility** | **> 95 / 100** | Minimum 4.5:1 text contrast, 44px touch targets, standard ARIA landmarks on tabs. |
| **Best Practices** | **> 95 / 100** | Zero console errors, HTTPS everywhere, no deprecated APIs. |
| **Bundle Size Budget** | **< 150 KB (gzip)** | Initial vendor chunk < 100 KB; MapLibre dynamically chunked and loaded on demand (< 180 KB). |
