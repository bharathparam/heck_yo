# RailBus Passenger Application: Comprehensive Test Plan & Quality Assurance

**Document ID:** `PASSENGER_TEST_PLAN`  
**Version:** 1.0  
**Testing Frameworks:** Vitest, React Testing Library, Playwright, Lighthouse CI  
**Status:** Under Review (Awaiting User Sign-off)

---

## 1. Quality Assurance Philosophy
In a demand-triggered transit system, software bugs directly cause physical passenger disruption—passengers stranded on platforms, buses dispatched unnecessarily, or unverified tickets rejected by conductors.

The RailBus Passenger Application test suite enforces deterministic verification across four quality tiers:
1. **Unit & Logic Testing:** Stepper bounds, idempotency key generation, status label mappings.
2. **Component & Integration Testing:** Offline transitions, payment simulation isolation, form validation.
3. **PWA & Offline Simulation Testing:** Airplane mode ticket recovery, cache isolation, service worker updates.
4. **End-to-End (E2E) Browser Testing:** Complete user journey from train registration to digital pass presentation.

---

## 2. Core Mandatory Verification Matrix

| Test Case ID | Test Scenario | Preconditions & Execution Steps | Expected Outcome & Assertion Criteria |
| :--- | :--- | :--- | :--- |
| **TC-OFF-01** | **Offline Ticket & QR Recovery** | 1. User completes booking while online.<br>2. Ticket renders with QR code.<br>3. Terminate app; enable Airplane Mode (`navigator.onLine = false`).<br>4. Re-open RailBus PWA. | The app launches from precache. The Tickets tab renders the cached ticket, displays the identical server HMAC QR code, and shows the badge: `"Last verified by server at HH:MM"`. |
| **TC-OFF-02** | **Offline Action Guarding** | 1. Enable Airplane mode.<br>2. Navigate to `/book` or `/book/pay`. | The sticky `OfflineBanner` appears at the top. The `"Proceed to Payment"` and `"Simulate Payment"` buttons are disabled with copy explaining that internet is required. |
| **TC-OFF-03** | **Demand Staleness Badging** | 1. Load available buses while online (showing 17/20 booked).<br>2. Disconnect network. | Demand progress bar displays `"17 of 20 booked (Last updated at 14:10)"`. No live status pulse. |
| **TC-SEC-01** | **SW Token & Payment Cache Isolation** | 1. Inspect Workbox Cache Storage after completing login and payment transactions. | **Zero instances** of `/payments/*`, `/login`, `/register`, or requests containing `Authorization: Bearer` headers exist in Cache Storage. |
| **TC-UPD-01** | **Non-Intrusive Update Toast** | 1. User is on `/book/pay` filling details.<br>2. Service worker detects new application build (`needRefresh = true`). | The app **does not reload**. The update toast is deferred until the user completes the booking or navigates to `/schedules`. |
| **TC-I18N-01** | **Persistent Language Parity** | 1. Tap `[ ಕನ್ನಡ ]` toggle.<br>2. Verify all UI strings flip to Kannada.<br>3. Force hard browser refresh (`Ctrl+F5`). | Application reloads directly in Kannada. `localStorage.getItem('railbus_lang')` returns `'kn'`. Line heights do not overlap. |
| **TC-VAL-01** | **Server-Dictated Ticket Validity** | 1. Open cached ticket with status `CANCELLED` or `REJECTED`. | The app displays the ticket with a clear cancelled state and disables QR display. The app never synthesizes a "VALID" pass without server confirmation. |
| **TC-PAY-01** | **Idempotency Key Reuse on Retry** | 1. Trigger `POST /payments/initiate` (UUID v4 generated).<br>2. Simulate network disconnect before response.<br>3. Tap Retry. | The client re-sends the **identical** UUID v4 `idempotencyKey`. The backend detects existing key and prevents duplicate billing. |
| **TC-PAY-02** | **Payment Failure Isolation** | 1. Select `[Simulate Payment Failure]` in modal.<br>2. Click Confirm. | Endpoint returns `FAILED`. Booking remains `PENDING_PAYMENT`. Trip demand counter is **not** incremented. User is returned to checkout. |

---

## 3. Unit & Component Test Specifications (Vitest + RTL)

```typescript
// tests/unit/SeatStepper.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SeatStepper } from '../../src/components/booking/SeatStepper';

describe('SeatStepper Component', () => {
  it('enforces lower bound of 1 seat', () => {
    const onChange = vi.fn();
    render(<SeatStepper value={1} min={1} max={6} onChange={onChange} />);

    const decrementBtn = screen.getByRole('button', { name: /decrease/i });
    expect(decrementBtn).toBeDisabled();

    fireEvent.click(decrementBtn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('enforces upper bound of 6 seats', () => {
    const onChange = vi.fn();
    render(<SeatStepper value={6} min={1} max={6} onChange={onChange} />);

    const incrementBtn = screen.getByRole('button', { name: /increase/i });
    expect(incrementBtn).toBeDisabled();

    fireEvent.click(incrementBtn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('correctly increments within valid bounds', () => {
    const onChange = vi.fn();
    render(<SeatStepper value={3} min={1} max={6} onChange={onChange} />);

    const incrementBtn = screen.getByRole('button', { name: /increase/i });
    fireEvent.click(incrementBtn);
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
```

```typescript
// tests/unit/StatusMapping.test.ts
import { describe, it, expect } from 'vitest';
import { getTripStatusDisplay } from '../../src/utils/statusUtils';

describe('Trip Status Display Mapping', () => {
  it('never displays raw internal codes to passengers', () => {
    const openStatus = getTripStatusDisplay('OPEN', 14, 20, 'en');
    expect(openStatus.label).toBe('Collecting Bookings');
    expect(openStatus.description).toContain('14 of 20 confirmed bookings');

    const eligibleStatus = getTripStatusDisplay('ELIGIBLE', 20, 20, 'en');
    expect(eligibleStatus.label).toBe('Goal Reached - In Review');
    expect(eligibleStatus.isApproved).toBe(false); // Does not promise bus until APPROVED
  });
});
```

---

## 4. End-to-End Automation Scenarios (Playwright)

```typescript
// tests/e2e/offline-ticket.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Offline Ticket Presentation E2E', () => {
  test('Passenger can access confirmed ticket in airplane mode', async ({ page, context }) => {
    // 1. Navigate to app and login
    await page.goto('/');
    await page.fill('input[name="identifier"]', 'passenger@example.com');
    await page.fill('input[name="password"]', 'pass123');
    await page.click('button[type="submit"]');

    // 2. Complete a booking via mock API
    await page.click('text=Find Matching Buses');
    await page.click('button:has-text("Select") >> nth=0');
    await page.click('button:has-text("Proceed to Payment")');
    await page.check('text=Simulate Payment Success');
    await page.click('button:has-text("Pay & Confirm")');

    // 3. Confirm ticket is displayed with QR code
    await expect(page.locator('[data-testid="ticket-qr-canvas"]')).toBeVisible();
    const ticketCode = await page.locator('[data-testid="ticket-code"]').innerText();

    // 4. Simulate complete network disconnection (Airplane Mode)
    await context.setOffline(true);

    // 5. Reload application while completely offline
    await page.reload();

    // 6. Verify PWA shell renders offline banner and cached ticket pass
    await expect(page.locator('text=Offline Mode')).toBeVisible();
    await page.click('nav >> text=Tickets');
    await expect(page.locator(`text=${ticketCode}`)).toBeVisible();
    await expect(page.locator('[data-testid="ticket-qr-canvas"]')).toBeVisible();
    await expect(page.locator('text=Last verified by server')).toBeVisible();
  });
});
```

---

## 5. Automated Lighthouse PWA Audit Suite

A dedicated CI script (`npm run audit:pwa`) executes Google Lighthouse in headless Chrome:
```bash
npx lighthouse http://localhost:4173 \
  --only-categories=pwa,performance,accessibility,best-practices \
  --chrome-flags="--headless" \
  --output=json \
  --output-path=./lighthouse-report.json
```

### Automated Assertions:
1. `report.categories.pwa.score === 1.0` (Must satisfy installable manifest, registered service worker, maskable icons).
2. `report.categories.accessibility.score >= 0.95`.
3. `report.audits['installable-manifest'].score === 1`.
4. `report.audits['service-worker'].score === 1`.
