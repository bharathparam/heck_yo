import tempfile
import unittest
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

from fastapi import HTTPException

import backend.main as service


class DemandDispatchWorkflowTest(unittest.TestCase):
    def setUp(self):
        self.previous_db = service.DB_PATH
        service.DB_PATH = Path(tempfile.gettempdir()) / f"railbus-test-{uuid.uuid4().hex}.sqlite3"
        service.init_db()
        self.routes = service.list_routes(limit=500, offset=0)
        self.route = self.routes[0]
        self.stop = self.route["stops"][0]
        registered = service.register(service.RegisterBody(full_name="MVP Passenger", email=f"{uuid.uuid4().hex}@example.test", phone="9999999999", password="password123"))
        self.passenger = self.user_from_token(registered["access_token"])
        self.admin = self.user_from_token(service.login(service.LoginBody(email="admin@railbus.com", password="password123"))["access_token"])

    def tearDown(self):
        path = service.DB_PATH
        service.DB_PATH = self.previous_db
        for suffix in ("", "-wal", "-shm"):
            candidate = Path(str(path) + suffix)
            if candidate.exists(): candidate.unlink()

    @staticmethod
    def user_from_token(token):
        with service.db() as con:
            return con.execute("SELECT * FROM users WHERE id=?", (service.decode_token(token),)).fetchone()

    def resolve(self, train="12614"):
        body = service.ResolveTripBody(route_id=self.route["id"], destination_stop_id=self.stop["id"], train_number=train, travel_date="2099-01-01")
        return service.resolve_trip(body, self.passenger)

    def pay(self, trip_id, seats):
        return service.pay_for_reservation(service.DirectPaymentBody(trip_id=trip_id, destination_stop_id=self.stop["id"], seat_count=seats), self.passenger)

    def test_direct_payment_waitlist_threshold_and_dispatch(self):
        trip = self.resolve()
        bookings = [self.pay(trip["id"], seats) for seats in (6, 6, 6, 1)]
        self.assertTrue(all(row["status"] == "WAITING_DISPATCH" and "ticket" not in row for row in bookings))
        with self.assertRaises(HTTPException): service.dispatch_service(trip["id"], None, self.admin)
        final = self.pay(trip["id"], 1)
        self.assertIn(final["trip"]["status"], ("THRESHOLD_MET", "READY_TO_DISPATCH"))
        self.assertNotIn("ticket", final)
        self.assertTrue(any(n["kind"] == "DISPATCH_REQUIRED" for n in service.passenger_notifications(self.admin)))
        assigned = service.dispatch_service(trip["id"], None, self.admin)
        self.assertIn(assigned["status"], ("SCHEDULED", "DISPATCHED"))
        self.assertTrue(all(row["ticket"]["qr_content"] for row in service.passenger_bookings(self.passenger)))

    def test_assign_bus_and_conductor_conflict_errors(self):
        trip1 = self.resolve(train="12614")
        for _ in range(3): self.pay(trip1["id"], 6)
        self.pay(trip1["id"], 2)
        # Assign bus-1 and conductor1
        assigned1 = service.assign_trip(trip1["id"], service.AssignTripBody(bus_id="bus-1", conductor_id=self.conductor_id()), self.admin)
        self.assertIn(assigned1["status"], ("SCHEDULED", "DISPATCHED"))

        # Create second trip on same travel date
        route2 = self.routes[1] if len(self.routes) > 1 else self.route
        stop2 = route2["stops"][0]
        trip2_body = service.ResolveTripBody(route_id=route2["id"], destination_stop_id=stop2["id"], train_number="16216", travel_date="2099-01-01")
        trip2 = service.resolve_trip(trip2_body, self.passenger)
        for _ in range(3): service.pay_for_reservation(service.PaymentBody(trip_id=trip2["id"], destination_stop_id=stop2["id"], seat_count=6), self.passenger)
        service.pay_for_reservation(service.PaymentBody(trip_id=trip2["id"], destination_stop_id=stop2["id"], seat_count=2), self.passenger)

        # Attempt to assign the same bus-1 -> conflict 409
        with self.assertRaises(HTTPException) as ctx:
            service.assign_trip(trip2["id"], service.AssignTripBody(bus_id="bus-1"), self.admin)
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIn("Bus conflict", ctx.exception.detail)

    def conductor_id(self):
        with service.db() as con:
            return con.execute("SELECT id FROM users WHERE role='CONDUCTOR'").fetchone()["id"]

    def test_role_guards(self):
        trip = self.resolve()
        # Passenger cannot call dispatch / assign
        with self.assertRaises(HTTPException) as ctx:
            service.assign_trip(trip["id"], None, self.passenger)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_capacity_prevents_overselling(self):
        trip = self.resolve()
        self.pay(trip["id"], 6); self.pay(trip["id"], 6); self.pay(trip["id"], 6); self.pay(trip["id"], 1); self.pay(trip["id"], 1)
        with self.assertRaises(HTTPException) as error: self.pay(trip["id"], 1)
        self.assertEqual(error.exception.status_code, 409)

    def test_expiry_cancels_direct_paid_reservation_without_gateway_refund(self):
        trip = self.resolve()
        booking = self.pay(trip["id"], 1)
        with service.db() as con:
            con.execute("UPDATE trips SET deadline_at=? WHERE id=?", ((datetime.now(timezone.utc)-timedelta(minutes=1)).isoformat(), trip["id"]))
        service.expire_demand_groups()
        with service.db() as con:
            row = con.execute("SELECT status FROM bookings WHERE id=?", (booking["id"],)).fetchone()
        self.assertEqual(row["status"], "CANCELLED")
        self.assertTrue(any(n["kind"] == "SERVICE_CANCELLED" for n in service.passenger_notifications(self.passenger)))

    def test_destination_is_validated(self):
        bad = service.ResolveTripBody(route_id=self.route["id"], destination_stop_id="bad", train_number="12614", travel_date="2099-01-01")
        with self.assertRaises(HTTPException): service.resolve_trip(bad, self.passenger)


if __name__ == "__main__": unittest.main()
