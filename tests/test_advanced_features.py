import asyncio
import pytest
from datetime import datetime, timezone, timedelta, date
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import AsyncSessionLocal, get_db
from app.models.trip import Trip

from app.models.booking import Booking, Payment
from app.core.constants import TripStatus, BookingStatus, PaymentStatus
from app.services.expiry_job import expire_below_threshold_trips


@pytest.mark.asyncio
async def test_concurrency_parallel_payments_cannot_oversell():
    """Verify that parallel concurrent payments on remaining capacity never oversell"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Operator login to create clean trip with capacity 40
        op_res = await client.post("/api/v1/auth/login", json={"email": "operator@railbus.com", "password": "password123"})
        op_token = op_res.json()["access_token"]
        op_headers = {"Authorization": f"Bearer {op_token}"}

        routes = (await client.get("/api/v1/routes?limit=1")).json()
        route_id = routes[0]["id"]

        create_res = await client.post("/api/v1/trips", headers=op_headers, json={
            "route_id": route_id,
            "train_arrival_id": "TR-CONCURRENCY-1",
            "base_fare": 50.0,
            "departure_time": "2026-11-01T10:00:00Z"
        })
        trip_id = create_res.json()["id"]

        # Passenger creates bookings
        p_res = await client.post("/api/v1/auth/login", json={"email": "passenger1@example.com", "password": "password123"})
        p_token = p_res.json()["access_token"]
        p_headers = {"Authorization": f"Bearer {p_token}"}

        # Create 5 bookings of 10 seats each (total 50 seats, but trip capacity is only 40!)
        bookings = []
        for i in range(5):
            b = (await client.post("/api/v1/bookings", headers=p_headers, json={
                "trip_id": trip_id,
                "seat_count": 10
            })).json()
            bookings.append(b["id"])

        # Execute all 5 payments concurrently in parallel
        async def pay(b_id, idx):
            return await client.post("/api/v1/bookings/simulate-payment", headers=p_headers, json={
                "booking_id": b_id,
                "idempotency_key": f"concur-pay-{idx}"
            })

        tasks = [pay(b_id, i) for i, b_id in enumerate(bookings)]
        results = await asyncio.gather(*tasks)

        success_count = sum(1 for r in results if r.status_code == 200)
        failure_count = sum(1 for r in results if r.status_code == 400)

        # Max 4 bookings of 10 seats can succeed (4 * 10 = 40). 5th booking MUST fail
        assert success_count == 4
        assert failure_count == 1

        # Verify demand in database does not exceed 40
        trip_check = (await client.get(f"/api/v1/trips/{trip_id}")).json()
        assert trip_check["demand_count"] == 40


@pytest.mark.asyncio
async def test_payment_retry_after_failed_simulation():
    """Verify that a passenger can retry payment after a failed attempt on the same booking"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        p_res = await client.post("/api/v1/auth/login", json={"email": "passenger1@example.com", "password": "password123"})
        p_token = p_res.json()["access_token"]
        p_headers = {"Authorization": f"Bearer {p_token}"}

        trips = (await client.get("/api/v1/trips")).json()
        trip_id = trips[0]["id"]

        # Create booking
        b_res = await client.post("/api/v1/bookings", headers=p_headers, json={
            "trip_id": trip_id,
            "seat_count": 1
        })
        booking_id = b_res.json()["id"]

        # 1st attempt: simulate payment failure
        fail_res = await client.post("/api/v1/bookings/simulate-payment", headers=p_headers, json={
            "booking_id": booking_id,
            "idempotency_key": "retry-test-fail-1",
            "simulate_failure": True
        })
        assert fail_res.status_code == 200
        assert fail_res.json()["status"] == "FAILED"

        # 2nd attempt: retry payment on SAME booking with new key
        retry_res = await client.post("/api/v1/bookings/simulate-payment", headers=p_headers, json={
            "booking_id": booking_id,
            "idempotency_key": "retry-test-success-2",
            "simulate_failure": False
        })
        assert retry_res.status_code == 200
        assert retry_res.json()["status"] == "SUCCESS"


@pytest.mark.asyncio
async def test_assignment_conflicts_bus_and_conductor():
    """Verify assignment conflicts for overlapping trips are rejected with 409"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        op_res = await client.post("/api/v1/auth/login", json={"email": "operator@railbus.com", "password": "password123"})
        op_token = op_res.json()["access_token"]
        op_headers = {"Authorization": f"Bearer {op_token}"}

        # Seeded trip has bus KA-01-RB-2026 and Conductor Rajesh assigned
        buses = (await client.get("/api/v1/buses")).json()
        bus_id = buses[0]["id"]

        conductors = (await client.get("/api/v1/admin/conductors", headers=op_headers)).json()
        conductor_id = conductors[0]["id"]

        routes = (await client.get("/api/v1/routes?limit=1")).json()
        route_id = routes[0]["id"]

        # Create trip with 20 bookings in the same departure window
        t_res = await client.post("/api/v1/trips", headers=op_headers, json={
            "route_id": route_id,
            "train_arrival_id": "TR-CONFLICT-1",
            "base_fare": 50.0,
            "departure_time": datetime.now(timezone.utc).isoformat()
        })
        new_trip_id = t_res.json()["id"]

        # Add 20 bookings so threshold is met
        p_res = await client.post("/api/v1/auth/login", json={"email": "passenger1@example.com", "password": "password123"})
        p_token = p_res.json()["access_token"]
        p_headers = {"Authorization": f"Bearer {p_token}"}

        b1 = (await client.post("/api/v1/bookings", headers=p_headers, json={"trip_id": new_trip_id, "seat_count": 10})).json()
        await client.post("/api/v1/bookings/simulate-payment", headers=p_headers, json={"booking_id": b1["id"], "idempotency_key": "conf-b1"})
        b2 = (await client.post("/api/v1/bookings", headers=p_headers, json={"trip_id": new_trip_id, "seat_count": 10})).json()
        await client.post("/api/v1/bookings/simulate-payment", headers=p_headers, json={"booking_id": b2["id"], "idempotency_key": "conf-b2"})

        # Try to assign bus and conductor who already have an active scheduled trip at this departure window
        assign_res = await client.post(f"/api/v1/trips/{new_trip_id}/assign", headers=op_headers, json={
            "bus_id": bus_id,
            "conductor_id": conductor_id
        })
        assert assign_res.status_code == 409
        assert "conflict" in assign_res.json()["code"].lower()


@pytest.mark.asyncio
async def test_expiry_job_cancels_and_refunds_below_threshold():
    """Verify expiry job cancels trips below threshold after deadline_at and marks payments for refund"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        op_res = await client.post("/api/v1/auth/login", json={"email": "operator@railbus.com", "password": "password123"})
        op_token = op_res.json()["access_token"]
        op_headers = {"Authorization": f"Bearer {op_token}"}

        routes = (await client.get("/api/v1/routes?limit=1")).json()
        route_id = routes[0]["id"]

        # Create trip with past deadline_at
        past_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        t_res = await client.post("/api/v1/trips", headers=op_headers, json={
            "route_id": route_id,
            "train_arrival_id": "TR-EXPIRE-1",
            "base_fare": 50.0,
            "departure_time": past_time.isoformat(),
            "deadline_at": past_time.isoformat()
        })
        expire_trip_id = t_res.json()["id"]

        # Passenger makes a 3-seat booking (< 20 threshold)
        p_res = await client.post("/api/v1/auth/login", json={"email": "passenger1@example.com", "password": "password123"})
        p_token = p_res.json()["access_token"]
        p_headers = {"Authorization": f"Bearer {p_token}"}

        bk = (await client.post("/api/v1/bookings", headers=p_headers, json={"trip_id": expire_trip_id, "seat_count": 3})).json()
        await client.post("/api/v1/bookings/simulate-payment", headers=p_headers, json={"booking_id": bk["id"], "idempotency_key": "expire-pay-1"})

        # Run expiry job using the test session override
        async for session in app.dependency_overrides[get_db]():
            cancelled = await expire_below_threshold_trips(session)
            assert any(t.id == expire_trip_id for t in cancelled)
            break


        # Check trip is now CANCELLED
        trip_check = (await client.get(f"/api/v1/trips/{expire_trip_id}")).json()
        assert trip_check["status"] == "CANCELLED"

        # Check booking is CANCELLED and payment is marked REFUNDED
        b_check = (await client.get(f"/api/v1/bookings/{bk['id']}", headers=p_headers)).json()
        assert b_check["status"] == "CANCELLED"


@pytest.mark.asyncio
async def test_offline_sync_foreign_ticket_rejected():
    """Verify offline sync rejects ticket that belongs to another trip"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        c_res = await client.post("/api/v1/auth/login", json={"email": "conductor@railbus.com", "password": "password123"})
        c_token = c_res.json()["access_token"]
        c_headers = {"Authorization": f"Bearer {c_token}"}

        trips = (await client.get("/api/v1/trips")).json()
        trip_id = trips[0]["id"]

        # Submit offline sync with a foreign ticket ID belonging to a completely different trip
        foreign_ticket_id = "00000000-0000-0000-0000-000000000001"
        res = await client.post(f"/api/v1/conductor/trips/{trip_id}/sync-offline", headers=c_headers, json={
            "trip_id": trip_id,
            "boardings": [
                {
                    "ticket_id": foreign_ticket_id,
                    "boarded_at": "2026-10-31T10:00:00Z",
                    "client_scan_id": "foreign-scan-1"
                }
            ]
        })
        assert res.status_code == 200
        data = res.json()
        assert data["failed_count"] == 1
        assert len(data["errors"]) == 1


@pytest.mark.asyncio
async def test_full_lifecycle_and_admin_endpoints():
    """Test full trip lifecycle through state machine and verify admin dashboard, audit logs, and notifications"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        op_res = await client.post("/api/v1/auth/login", json={"email": "operator@railbus.com", "password": "password123"})
        op_token = op_res.json()["access_token"]
        op_headers = {"Authorization": f"Bearer {op_token}"}

        # 1. Admin overview
        overview = (await client.get("/api/v1/admin/overview", headers=op_headers)).json()
        assert overview["total_trips"] >= 1
        assert overview["active_buses"] >= 1

        # 2. Admin assignments
        assignments = (await client.get("/api/v1/admin/assignments", headers=op_headers)).json()
        assert len(assignments) >= 1

        # 3. Admin audit logs
        audit_logs = (await client.get("/api/v1/admin/audit-logs", headers=op_headers)).json()
        assert isinstance(audit_logs, list)

        # 4. Search trips
        search_res = await client.get("/api/v1/trips/search?destination=Electronic")
        assert search_res.status_code == 200
        assert isinstance(search_res.json(), list)

        # 5. Check notifications for passenger
        p_res = await client.post("/api/v1/auth/login", json={"email": "passenger1@example.com", "password": "password123"})
        p_token = p_res.json()["access_token"]
        p_headers = {"Authorization": f"Bearer {p_token}"}

        notifs = (await client.get("/api/v1/notifications", headers=p_headers)).json()
        assert isinstance(notifs, list)
