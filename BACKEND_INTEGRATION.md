# RailBus API integration

FastAPI runs from `backend/main.py`; SQLite stores accounts, CSV routes, demand groups, direct-pay reservations, notifications, and tickets. Start the stack with `npm run dev:all`; API docs are at `http://127.0.0.1:8008/docs`.

## Passenger and dispatch flow

1. Register or login: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`.
2. Search routes from Mysuru Junction: `POST /api/v1/services/search` with destination, train number, and travel date. It returns route, common fare, 20-seat capacity, live paid-seat count, and remaining capacity.
3. Select a route: `POST /api/v1/trips/resolve` creates/returns the shared train-route-destination-date demand group.
4. Tap **Pay**: `POST /api/v1/payments/pay` records an MVP paid reservation directly, checks capacity transactionally, and returns a `WAITING_DISPATCH` booking. This does not charge real money.
5. At 20 paid seats, Admin receives an in-app dispatch notification. Admin reviews `GET /api/v1/operator/bookings` and dispatches using `POST /api/v1/operator/trips/{trip_id}/dispatch`. Dispatch issues signed tickets and notifies passengers.
6. Conductor sees approved services at `GET /api/v1/conductor/trips`, claims boarding, views the manifest, and validates signed QR content or ticket reference before departing/completing.

## Expiry and notifications

- Demand expires after `RAILBUS_DEMAND_WINDOW_HOURS` (12 hours by default). Groups below 20 seats are cancelled, and passengers receive in-app cancellation notifications. No real charge or automatic refund occurs in this MVP.
- Passenger booking history and `GET /api/v1/notifications` show waiting, confirmed ticket, and cancellation states. The app polls for updates while open.

## Roles and data boundaries

- Passenger accounts are self-registered and can view only their own bookings, notifications, and tickets.
- Admin/Operator can inspect paid reservations and approve dispatch, but cannot create arbitrary trips or manually assign buses.
- Conductors see only dispatched services; only the conductor who claims the service can view its passenger manifest or validate tickets.
- Route/stop records are sourced from `bus_routes.csv`. The app does not have live train-arrival, SMS/WhatsApp, or KSRTC fleet-dispatch integrations.

Verify using `python -m unittest backend.test_workflow -v` and `npm run build`.
