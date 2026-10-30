import base64
import json
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import generate_qr_ticket_string, sign_qr_payload


@pytest.mark.asyncio
async def test_edge_case_capacity_exceeded():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Login Passenger
        p_res = await client.post("/api/v1/auth/login", json={"email": "passenger1@example.com", "password": "password123"})
        p_token = p_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {p_token}"}

        # Seeded trip has capacity 40 and demand 22 (remaining = 18)
        trips = (await client.get("/api/v1/trips")).json()
        trip_id = trips[0]["id"]

        # Attempt to book 19 seats (exceeds capacity: 22 + 19 = 41 > 40)
        # Note: BookingCreate validation permits up to 10 seats per booking, let's test seat_count = 10
        # First booking: 10 seats
        res1 = await client.post("/api/v1/bookings", headers=headers, json={"trip_id": trip_id, "seat_count": 10})
        assert res1.status_code == 200
        bk1_id = res1.json()["id"]

        # Pay for booking 1 (demand becomes 22 + 10 = 32, remaining = 8)
        await client.post("/api/v1/bookings/simulate-payment", headers=headers, json={"booking_id": bk1_id, "idempotency_key": "cap-idem-1"})

        # Try to book 9 seats (demand 32 + 9 = 41 > 40)
        res_exceed = await client.post("/api/v1/bookings", headers=headers, json={"trip_id": trip_id, "seat_count": 9})
        assert res_exceed.status_code == 400
        err = res_exceed.json()
        assert err["code"] == "CAPACITY_EXCEEDED"


@pytest.mark.asyncio
async def test_edge_case_booking_on_departed_or_completed_trip():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Login Conductor & Passenger
        c_res = await client.post("/api/v1/auth/login", json={"email": "conductor@railbus.com", "password": "password123"})
        c_token = c_res.json()["access_token"]
        c_headers = {"Authorization": f"Bearer {c_token}"}

        p_res = await client.post("/api/v1/auth/login", json={"email": "passenger1@example.com", "password": "password123"})
        p_token = p_res.json()["access_token"]
        p_headers = {"Authorization": f"Bearer {p_token}"}

        trips = (await client.get("/api/v1/trips")).json()
        trip_id = trips[0]["id"]

        # Conductor opens boarding and marks trip DEPARTED
        await client.post(f"/api/v1/conductor/trips/{trip_id}/boarding/open", headers=c_headers)
        await client.post(f"/api/v1/conductor/trips/{trip_id}/depart", headers=c_headers)

        # Passenger attempts to book on departed trip
        book_res = await client.post("/api/v1/bookings", headers=p_headers, json={"trip_id": trip_id, "seat_count": 1})
        assert book_res.status_code == 400
        assert "departed" in book_res.json()["error"].lower()


@pytest.mark.asyncio
async def test_edge_case_payment_idempotency_and_double_payment():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        p_res = await client.post("/api/v1/auth/login", json={"email": "passenger1@example.com", "password": "password123"})
        p_token = p_res.json()["access_token"]
        p_headers = {"Authorization": f"Bearer {p_token}"}

        trips = (await client.get("/api/v1/trips")).json()
        trip_id = trips[0]["id"]
        initial_demand = trips[0]["demand_count"]

        # Create booking
        bk = (await client.post("/api/v1/bookings", headers=p_headers, json={"trip_id": trip_id, "seat_count": 2})).json()
        booking_id = bk["id"]

        # 1. First payment call with idempotency key
        pay1 = (await client.post("/api/v1/bookings/simulate-payment", headers=p_headers, json={
            "booking_id": booking_id,
            "idempotency_key": "idem-unique-key-999"
        })).json()
        assert pay1["status"] == "SUCCESS"

        # Check trip demand increased by 2
        trip_mid = (await client.get(f"/api/v1/trips/{trip_id}")).json()
        assert trip_mid["demand_count"] == initial_demand + 2

        # 2. Resubmit exact same payment request (simulating network retry)
        pay2 = (await client.post("/api/v1/bookings/simulate-payment", headers=p_headers, json={
            "booking_id": booking_id,
            "idempotency_key": "idem-unique-key-999"
        })).json()
        assert pay2["id"] == pay1["id"]

        # Demand count MUST NOT have increased again
        trip_after = (await client.get(f"/api/v1/trips/{trip_id}")).json()
        assert trip_after["demand_count"] == initial_demand + 2

        # 3. Attempt to pay for the confirmed booking with a DIFFERENT idempotency key
        double_pay = await client.post("/api/v1/bookings/simulate-payment", headers=p_headers, json={
            "booking_id": booking_id,
            "idempotency_key": "idem-different-key-888"
        })
        assert double_pay.status_code == 400
        assert "already been confirmed" in double_pay.json()["error"].lower()


@pytest.mark.asyncio
async def test_edge_case_payment_failure_simulation():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        p_res = await client.post("/api/v1/auth/login", json={"email": "passenger1@example.com", "password": "password123"})
        p_token = p_res.json()["access_token"]
        p_headers = {"Authorization": f"Bearer {p_token}"}

        trips = (await client.get("/api/v1/trips")).json()
        trip_id = trips[0]["id"]
        initial_demand = trips[0]["demand_count"]

        # Create booking
        bk = (await client.post("/api/v1/bookings", headers=p_headers, json={"trip_id": trip_id, "seat_count": 1})).json()

        # Simulate Payment Failure
        fail_res = (await client.post("/api/v1/bookings/simulate-payment", headers=p_headers, json={
            "booking_id": bk["id"],
            "idempotency_key": "fail-test-idem-1",
            "simulate_failure": True
        })).json()
        assert fail_res["status"] == "FAILED"

        # Demand count must remain unchanged
        trip_check = (await client.get(f"/api/v1/trips/{trip_id}")).json()
        assert trip_check["demand_count"] == initial_demand


@pytest.mark.asyncio
async def test_edge_case_qr_tampering_and_mismatches():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        c_res = await client.post("/api/v1/auth/login", json={"email": "conductor@railbus.com", "password": "password123"})
        c_token = c_res.json()["access_token"]
        c_headers = {"Authorization": f"Bearer {c_token}"}

        trips = (await client.get("/api/v1/trips")).json()
        trip_id = trips[0]["id"]

        # Case 1: Malformed QR string with no dot
        res1 = await client.post(f"/api/v1/conductor/trips/{trip_id}/board", headers=c_headers, json={"qr_code": "malformedqrstringnodots"})
        assert res1.status_code == 404 or res1.status_code == 400

        # Case 2: Tampered payload with original signature
        raw_qr, payload_json, signature = generate_qr_ticket_string("some-ticket-id", trip_id)
        # Modify payload to another ticket id but keep old signature
        tampered_payload = json.dumps({"ticket_id": "forged-id-1234", "trip_id": trip_id, "issued_at": "2026-10-30T10:00:00Z"})
        tampered_b64 = base64.urlsafe_b64encode(tampered_payload.encode()).decode().rstrip("=")
        forged_qr = f"{tampered_b64}.{signature}"

        res2 = await client.post(f"/api/v1/conductor/trips/{trip_id}/board", headers=c_headers, json={"qr_code": forged_qr})
        assert res2.status_code == 400
        assert res2.json()["code"] == "INVALID_TICKET"

        # Case 3: Valid signed ticket for Trip A scanned on Trip B
        other_trip_id = "00000000-0000-0000-0000-000000000000"
        mismatched_qr, _, _ = generate_qr_ticket_string("some-ticket-id", other_trip_id)
        res3 = await client.post(f"/api/v1/conductor/trips/{trip_id}/board", headers=c_headers, json={"qr_code": mismatched_qr})
        assert res3.status_code == 400
        assert "different trip" in res3.json()["error"].lower()


@pytest.mark.asyncio
async def test_edge_case_unauthorized_conductor():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Register a second conductor (Conductor B)
        await client.post("/api/v1/auth/register", json={
            "email": "conductor_b@railbus.com",
            "password": "password123",
            "full_name": "Suresh Conductor B",
            "role": "CONDUCTOR",
            "employee_id": "RB-COND-002"
        })

        b_res = await client.post("/api/v1/auth/login", json={"email": "conductor_b@railbus.com", "password": "password123"})
        b_token = b_res.json()["access_token"]
        b_headers = {"Authorization": f"Bearer {b_token}"}

        # Seeded trip is assigned to Conductor A (Rajesh)
        trips = (await client.get("/api/v1/trips")).json()
        trip_id = trips[0]["id"]

        # Conductor B attempts to access manifest for Conductor A's trip -> FORBIDDEN
        manifest_res = await client.get(f"/api/v1/conductor/trips/{trip_id}/manifest", headers=b_headers)
        assert manifest_res.status_code == 403

        # Conductor B attempts to open boarding for Conductor A's trip -> FORBIDDEN
        open_res = await client.post(f"/api/v1/conductor/trips/{trip_id}/boarding/open", headers=b_headers)
        assert open_res.status_code == 403

        # Conductor B attempts to board ticket on Conductor A's trip -> FORBIDDEN
        board_res = await client.post(f"/api/v1/conductor/trips/{trip_id}/board", headers=b_headers, json={"qr_code": "any"})
        assert board_res.status_code == 403


@pytest.mark.asyncio
async def test_edge_case_offline_batch_sync_resilience():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        c_res = await client.post("/api/v1/auth/login", json={"email": "conductor@railbus.com", "password": "password123"})
        c_token = c_res.json()["access_token"]
        c_headers = {"Authorization": f"Bearer {c_token}"}

        trips = (await client.get("/api/v1/trips")).json()
        trip_id = trips[0]["id"]

        # Get manifest
        manifest = (await client.get(f"/api/v1/conductor/trips/{trip_id}/manifest", headers=c_headers)).json()["manifest"]
        tkt1 = manifest[0]["ticket_id"]
        tkt2 = manifest[1]["ticket_id"]

        # 1. Board tkt1 online first
        await client.post(f"/api/v1/conductor/trips/{trip_id}/board", headers=c_headers, json={"qr_code": tkt1})

        # 2. Offline batch contains:
        # - tkt1 (already boarded online: duplicate test)
        # - tkt2 (valid unboarded ticket: should succeed)
        # - fake_ticket_id (non-existent: should be recorded as failed, without failing entire batch)
        batch_res = await client.post(f"/api/v1/conductor/trips/{trip_id}/sync-offline", headers=c_headers, json={
            "trip_id": trip_id,
            "boardings": [
                {"ticket_id": tkt1, "boarded_at": "2026-10-30T10:00:00Z"},
                {"ticket_id": tkt2, "boarded_at": "2026-10-30T10:01:00Z"},
                {"ticket_id": "00000000-fake-0000-0000-000000000000", "boarded_at": "2026-10-30T10:02:00Z"}
            ]
        })
        assert batch_res.status_code == 200
        data = batch_res.json()
        assert data["synced_count"] == 1        # tkt2 successfully synced
        assert data["failed_count"] == 1        # fake ticket failed
        assert len(data["errors"]) == 1
        assert "not found" in data["errors"][0].lower()


@pytest.mark.asyncio
async def test_edge_case_double_boarding_prevention():
    """Verify that scanning the same ticket twice (replay attack) is strictly rejected with ALREADY_BOARDED"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        c_res = await client.post("/api/v1/auth/login", json={"email": "conductor@railbus.com", "password": "password123"})
        c_token = c_res.json()["access_token"]
        c_headers = {"Authorization": f"Bearer {c_token}"}

        trips = (await client.get("/api/v1/trips")).json()
        trip_id = trips[0]["id"]

        # Conductor ensures boarding window is open
        await client.post(f"/api/v1/conductor/trips/{trip_id}/boarding/open", headers=c_headers)

        manifest = (await client.get(f"/api/v1/conductor/trips/{trip_id}/manifest", headers=c_headers)).json()["manifest"]
        # Pick an unboarded ticket
        unboarded = [m for m in manifest if m["status"] != "BOARDED"]
        assert len(unboarded) > 0, "Expected at least one unboarded ticket"
        target_ticket = unboarded[0]

        # First boarding attempt -> Succeeded
        board_res1 = await client.post(
            f"/api/v1/conductor/trips/{trip_id}/board",
            headers=c_headers,
            json={"qr_code": target_ticket["ticket_id"]}
        )
        assert board_res1.status_code == 200
        assert board_res1.json()["success"] is True

        # Replay attempt with same ticket -> Must fail with ALREADY_BOARDED (409 Conflict)
        board_res2 = await client.post(
            f"/api/v1/conductor/trips/{trip_id}/board",
            headers=c_headers,
            json={"qr_code": target_ticket["ticket_id"]}
        )
        assert board_res2.status_code == 409
        assert board_res2.json()["code"] == "ALREADY_BOARDED"


@pytest.mark.asyncio
async def test_edge_case_operator_premature_assignment_rejected():
    """Verify operator cannot assign bus/conductor if demand < 20 (activation threshold)"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        op_res = await client.post("/api/v1/auth/login", json={"email": "operator@railbus.com", "password": "password123"})
        op_token = op_res.json()["access_token"]
        op_headers = {"Authorization": f"Bearer {op_token}"}

        routes = (await client.get("/api/v1/routes?limit=1")).json()
        route_id = routes[0]["id"]

        # Create a new trip with 0 demand
        new_trip_res = await client.post("/api/v1/trips", headers=op_headers, json={
            "route_id": route_id,
            "train_arrival_id": "TR-EDGE-TEST",
            "departure_time": "2026-10-31T18:00:00Z",
            "base_fare": 45.0
        })
        assert new_trip_res.status_code == 200
        new_trip_id = new_trip_res.json()["id"]

        # Operator attempts premature assignment before 20 bookings
        assign_res = await client.post(f"/api/v1/trips/{new_trip_id}/assign", headers=op_headers, json={
            "bus_id": "some-bus-id",
            "conductor_id": "some-conductor-id"
        })
        assert assign_res.status_code == 400
        assert assign_res.json()["code"] == "THRESHOLD_NOT_MET"


@pytest.mark.asyncio
async def test_edge_case_role_privilege_escalation():
    """Verify role-based authorization prevents passenger from invoking operator or conductor actions"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        p_res = await client.post("/api/v1/auth/login", json={"email": "passenger1@example.com", "password": "password123"})
        p_token = p_res.json()["access_token"]
        p_headers = {"Authorization": f"Bearer {p_token}"}

        trips = (await client.get("/api/v1/trips")).json()
        trip_id = trips[0]["id"]

        # 1. Passenger tries to perform operator assignment
        op_res = await client.post(f"/api/v1/trips/{trip_id}/assign", headers=p_headers, json={
            "bus_id": "any",
            "conductor_id": "any"
        })
        assert op_res.status_code == 403

        # 2. Passenger tries to open conductor boarding
        open_res = await client.post(f"/api/v1/conductor/trips/{trip_id}/boarding/open", headers=p_headers)
        assert open_res.status_code == 403

        # 3. Passenger tries to board a ticket
        board_res = await client.post(f"/api/v1/conductor/trips/{trip_id}/board", headers=p_headers, json={"qr_code": "any"})
        assert board_res.status_code == 403

        # 4. Unauthenticated request without token to protected conductor endpoint
        unauth_res = await client.get(f"/api/v1/conductor/trips/{trip_id}/manifest")
        assert unauth_res.status_code == 401


@pytest.mark.asyncio
async def test_edge_case_tampered_or_invalid_jwt():
    """Verify tampered or invalid JWT headers return 401 Unauthorized"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        bad_headers = {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.invalidsignature"}
        res = await client.get("/api/v1/conductor/trips", headers=bad_headers)
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_edge_case_route_search_injection_and_unicode_handling():
    """Verify route searching handles SQL injection patterns, symbols, and unicode gracefully without crash"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # SQL injection attempt string
        sql_injection = "'; DROP TABLE routes; --"
        res1 = await client.get(f"/api/v1/routes?q={sql_injection}")
        assert res1.status_code == 200
        assert isinstance(res1.json(), list)

        # Wildcard / percent symbol
        res2 = await client.get("/api/v1/routes?q=%")
        assert res2.status_code == 200
        assert isinstance(res2.json(), list)

        # Unicode Kannada string
        res3 = await client.get("/api/v1/routes?q=ಮೈಸೂರು")
        assert res3.status_code == 200
        assert isinstance(res3.json(), list)

        # Non-existent route
        res4 = await client.get("/api/v1/routes?q=NonExistentRoute_XYZ_99999")
        assert res4.status_code == 200
        assert res4.json() == []


@pytest.mark.asyncio
async def test_edge_case_booking_validation_bounds():
    """Verify Pydantic input validation blocks seat_count < 1 or > 10 with 422"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        p_res = await client.post("/api/v1/auth/login", json={"email": "passenger1@example.com", "password": "password123"})
        p_token = p_res.json()["access_token"]
        p_headers = {"Authorization": f"Bearer {p_token}"}

        trips = (await client.get("/api/v1/trips")).json()
        trip_id = trips[0]["id"]

        # Zero seats
        res_zero = await client.post("/api/v1/bookings", headers=p_headers, json={"trip_id": trip_id, "seat_count": 0})
        assert res_zero.status_code == 422

        # Negative seats
        res_neg = await client.post("/api/v1/bookings", headers=p_headers, json={"trip_id": trip_id, "seat_count": -5})
        assert res_neg.status_code == 422

        # Exceeding maximum allowed seats per single booking (> 10)
        res_large = await client.post("/api/v1/bookings", headers=p_headers, json={"trip_id": trip_id, "seat_count": 50})
        assert res_large.status_code == 422

