# RailBus Operator Dashboard — Comprehensive Test Plan

**Document Version:** 1.0.0  
**Test Frameworks:** Vitest / React Testing Library / Playwright / MSW (Mock Service Worker)  
**Author:** Transport Operations Software Engineer & Quality Assurance Lead  

---

## 1. Testing Philosophy & Verification Strategy

Transport dispatch systems operate in real time where mistakes directly cause stranded passengers, bus collisions, or driver overtime violations. Therefore, the testing strategy is structured into four strict tiers:

1. **Unit & State Machine Verification:** Ensure mathematical threshold logic, time calculations, status mappings, and form validations are 100% covered.
2. **Component & Integration Testing (Vitest + React Testing Library + MSW):** Verify that UI components render correctly across loading, empty, and populated states, and properly dispatch API calls.
3. **End-to-End Workflow Testing (Playwright):** Validate complete user journeys: Operator login $\rightarrow$ Threshold notification $\rightarrow$ Review & Approval $\rightarrow$ Bus & Conductor Assignment $\rightarrow$ Manifest Tracking.
4. **Resilience & Fault Tolerance Testing:** Simulate network drops, delayed trains, simultaneous operator assignment race conditions, and API `4xx`/`5xx` error responses.

---

## 2. Core Functional Test Matrix

| Test ID | Module / Feature | Test Description | Expected Outcome | Severity |
| :--- | :--- | :--- | :--- | :--- |
| **TC-AUTH-01** | Authentication | Valid operator login via Supabase Auth | User lands on `/dashboard`, JWT attached to HTTP header | Critical |
| **TC-AUTH-02** | RBAC Guard | Operator attempts accessing Admin-only `/fleet/new` | Route blocked; redirect or 403 Forbidden alert shown | High |
| **TC-AUTH-03** | Session Timeout | Inactive session expires after token expiry | Redirection to `/login?reason=session_expired` | High |
| **TC-DASH-01** | Main Dashboard | Metric calculations match API response | KPI cards display exact numbers for Confirmed, Eligible, etc. | High |
| **TC-DASH-02** | Dashboard Realtime | New booking arrives via WebSocket | Confirmed count increments dynamically without full page reload | Medium |
| **TC-THRS-01** | Threshold Logic | Trip has 19 confirmed bookings ($<20$) | Status is `AGGREGATING`; "Approve" button is disabled | Critical |
| **TC-THRS-02** | Threshold Logic | Trip hits 20 confirmed bookings ($\ge 20$) | Status transitions to `ELIGIBLE`; "Approve" button activates; audio chime plays | Critical |
| **TC-THRS-03** | Threshold Logic | Passenger cancels; count drops from 20 to 19 | Status reverts from `ELIGIBLE` to `AGGREGATING`; "Approve" disabled | Critical |
| **TC-THRS-04** | Dynamic Threshold | Backend returns route threshold of 35 | Progress bar renders against 35; activates only at 35 | High |
| **TC-APPR-01** | Trip Approval | Operator clicks `Approve Trip` on eligible trip | `POST /api/operator/trips/{id}/approve` sent; status updates to `APPROVED` | Critical |
| **TC-APPR-02** | Unauthorized Approval | Tampered client sends approve on trip with 15 bookings | Backend returns `400 Bad Request`; UI shows rejection toast | Critical |
| **TC-REJC-01** | Trip Rejection | Operator rejects trip with reason code | `POST /api/operator/trips/{id}/reject` sent; refund count confirmed | High |
| **TC-ASGN-01** | Bus Assignment | Assign available bus with capacity $\ge$ demand | Status updates to `ASSIGNED`; bus marked `ASSIGNED` in fleet registry | Critical |
| **TC-ASGN-02** | Bus Overlap Conflict | Assign bus already assigned to another overlapping trip | Client disables bus or server returns `409 Conflict`; conflict modal shown | Critical |
| **TC-ASGN-03** | Bus Under-Capacity | Attempt assigning 20-seat bus to 25-passenger trip | Selection blocked with validation error: `"Capacity insufficient"` | High |
| **TC-COND-01** | Conductor Assignment| Assign on-duty conductor with $<4.5$ hrs continuous shift | Conductor assigned; trip updated | Critical |
| **TC-COND-02** | Conductor Conflict | Attempt double-booking conductor across simultaneous trips | Blocked with `409 Conflict`; conflict modal displayed | Critical |
| **TC-TRN-01** | Train Delay Sync | Train arrival delayed by 20 minutes | Affected feeder trip displays `Intermodal Misalignment` warning | High |
| **TC-MANI-01** | Passenger Manifest | Conductor scans boarding pass in conductor app | Manifest row updates to `BOARDED`; Boarding meter increments | Medium |
| **TC-ANLY-01** | Operational Analytics| Conversion funnel renders across all 5 stages | Percentages match exact completed vs aggregating trip counts | Medium |
| **TC-FAIL-01** | API Failure | Backend returns `500 Internal Server Error` on trip list | Error boundary or inline retry card displayed; app does not crash | High |
| **TC-FAIL-02** | Network Disconnect | User disconnects from Wi-Fi / Ethernet | Offline status banner appears: `"Offline Mode - Action disabled"` | High |

---

## 3. Automated Test Suites Specification

### 3.1 Unit Test Specifications (Vitest)
- **`thresholdCalculations.test.ts`:**
  - Test calculation of percentage completion toward variable thresholds ($20$, $30$, $45$).
  - Test remaining cutoff time formatting (`mm:ss`, `hh:mm`).
- **`conflictCheckers.test.ts`:**
  - Test time-overlap detection function:
    $$\text{Overlap} = \max(T_{start1}, T_{start2}) < \min(T_{end1} + \Delta_{turnaround}, T_{end2} + \Delta_{turnaround})$$
  - Test bus capacity vs confirmed passenger validation.

### 3.2 Integration Test Specifications (React Testing Library + MSW)
- **`TripApprovalDrawer.test.tsx`:**
  - Render drawer with mock eligible trip (22/20 confirmed).
  - Verify "Approve Trip" button is enabled.
  - Click "Approve Trip": verify `POST /api/operator/trips/{id}/approve` called with proper headers.
  - Verify transition to Bus/Conductor assignment picker upon successful response.
- **`RejectTripModal.test.tsx`:**
  - Verify submission is blocked until a `rejection_code` is selected.
  - Verify rejection API call includes reason text note.

### 3.3 End-to-End Test Specifications (Playwright)
- **`e2e/approval-assignment-flow.spec.ts`:**
  1. Open browser, visit `/login`.
  2. Input operator credentials $\rightarrow$ click sign in.
  3. Verify landing on `/dashboard` with telemetry cards populated.
  4. Find trip `RB-402` in Eligible Trips Queue.
  5. Click `Review Details`.
  6. Assert Demand is 22 / 20.
  7. Click `Approve Trip`.
  8. Select Bus `BUS-07` and Conductor `Marcus Vance`.
  9. Click `Confirm Assignment`.
  10. Assert trip status badge in table changes to `ASSIGNED`.

---

## 4. Test Data Fixtures & MSW Handlers

The development and test environments use strictly typed fixtures:
- `fixtures/trips.json`: Contains sample trips in each lifecycle state (`AGGREGATING`, `ELIGIBLE`, `APPROVED`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `REJECTED`, `CANCELLED`).
- `fixtures/buses.json`: Contains buses with varying seating capacities (24, 28, 32, 40), wheelchair accessibility flags, and statuses (`AVAILABLE`, `ASSIGNED`, `MAINTENANCE`).
- `fixtures/conductors.json`: Contains active conductors with shift hours, certification statuses, and assigned trip references.
- `fixtures/trains.json`: Inbound trains with on-time, delayed (+18m), and cancelled schedules.
