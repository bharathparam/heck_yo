# Passenger App API Integration

This file describes the passenger app as implemented against the supplied RailBus backend guide. The backend guide and its OpenAPI schema are authoritative when a contract detail differs.

## Shared backend

The passenger app uses the same FastAPI service and `/api/v1` API as the Admin and Conductor dashboards. In the combined Vite setup, requests go to `/railbus-api/api/v1` on the browser's origin; Vite proxies them to `VITE_RAILBUS_BACKEND_URL`. This keeps backend credentials and CORS configuration out of the passenger browser.

Set `VITE_RAILBUS_BACKEND_URL` to the current backend or ngrok URL in the root `.env.local`, then restart `npm run dev:all`.

## Implemented passenger flow

| App action | Backend request |
| --- | --- |
| Passenger sign in | `POST /api/v1/auth/login` with `{ email, password }` |
| Restore/validate session | `GET /api/v1/auth/me` with the bearer token |
| Browse routes and stops | `GET /api/v1/routes?limit=200&offset=...` |
| Browse trips | `GET /api/v1/trips` |
| Create a seat booking | `POST /api/v1/bookings` with `{ trip_id, seat_count }` |
| Simulate payment and issue ticket | `POST /api/v1/bookings/simulate-payment` with `{ booking_id, idempotency_key, simulate_failure }` |
| Load server QR details | `GET /api/v1/tickets/{ticket_id}` |

The passenger demo account in the backend guide is `passenger1@example.com` / `password123`. The UI validates the returned role and only accepts `PASSENGER`. Tokens are held in `sessionStorage`; passenger profile details are refreshed from `/auth/me`.

Route, trip, booking, and ticket payloads are normalized from the backend's snake_case fields for the existing UI. A successful payment must return a ticket reference or ID and the server-issued QR data; the client never fabricates a ticket or QR code. If the backend cannot provide the ticket, the payment screen shows that error instead of opening a sample pass.

## Offline and contract limits

Confirmed tickets are stored in IndexedDB per passenger account and remain available offline. The supplied backend guide does not define passenger ticket-list, train-arrival, real-time subscription, or cancellation endpoints. Ticket history therefore shows tickets saved on this device; unsupported train and cancellation actions are not simulated. Booking and payment still require a live backend connection.

The previous mock adapter and seeded passenger bookings have been removed from the active app. API errors are shown in the UI and do not silently become mock data.
