import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import generate_qr_ticket_string, sign_qr_payload


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert data["threshold_activation"] == 20


@pytest.mark.asyncio
async def test_conductor_flow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Login as Conductor
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "conductor@railbus.com",
            "password": "password123"
        })
        assert login_res.status_code == 200
        auth_data = login_res.json()
        token = auth_data["access_token"]
        assert auth_data["role"] == "CONDUCTOR"

        headers = {"Authorization": f"Bearer {token}"}

        # 2. Get assigned trips
        trips_res = await client.get("/api/v1/conductor/trips", headers=headers)
        assert trips_res.status_code == 200
        trips = trips_res.json()
        assert len(trips) >= 1
        trip = trips[0]
        trip_id = trip["id"]
        assert trip["total_confirmed_passengers"] >= 20

        # 3. Get manifest
        manifest_res = await client.get(f"/api/v1/conductor/trips/{trip_id}/manifest", headers=headers)
        assert manifest_res.status_code == 200
        manifest_data = manifest_res.json()
        manifest = manifest_data["manifest"]
        assert len(manifest) >= 20
        first_ticket = manifest[0]
        assert first_ticket["status"] == "ISSUED"

        # 4. Open Boarding
        open_res = await client.post(f"/api/v1/conductor/trips/{trip_id}/boarding/open", headers=headers)
        assert open_res.status_code == 200
        assert open_res.json()["status"] == "BOARDING"

        # 5. Fetch full ticket details to get valid signed QR string
        ticket_id = first_ticket["ticket_id"]
        tkt_res = await client.get(f"/api/v1/tickets/{ticket_id}", headers=headers)
        assert tkt_res.status_code == 200
        tkt_data = tkt_res.json()
        valid_qr = tkt_data["qr_content"]
        assert "." in valid_qr

        # 6. Conductor scans and boards passenger ticket
        board_res = await client.post(
            f"/api/v1/conductor/trips/{trip_id}/board",
            headers=headers,
            json={"qr_code": valid_qr, "device_id": "test-device-01"}
        )
        assert board_res.status_code == 200
        board_data = board_res.json()
        assert board_data["success"] is True
        assert board_data["ticket_id"] == ticket_id
        assert board_data["boarded_count"] == 1

        # 7. Test Replay / Double Boarding (should reject with ALREADY_BOARDED / 409)
        reboard_res = await client.post(
            f"/api/v1/conductor/trips/{trip_id}/board",
            headers=headers,
            json={"qr_code": valid_qr, "device_id": "test-device-01"}
        )
        assert reboard_res.status_code == 409
        err = reboard_res.json()
        assert err["code"] == "ALREADY_BOARDED"

        # 8. Test Tampered / Invalid QR Signature (should reject with INVALID_TICKET / 400)
        tampered_qr = valid_qr[:-4] + "ffff"
        invalid_res = await client.post(
            f"/api/v1/conductor/trips/{trip_id}/board",
            headers=headers,
            json={"qr_code": tampered_qr}
        )
        assert invalid_res.status_code == 400
        assert invalid_res.json()["code"] == "INVALID_TICKET"

        # 9. Test Offline Batch Sync with second passenger ticket
        second_ticket = manifest[1]
        batch_res = await client.post(
            f"/api/v1/conductor/trips/{trip_id}/sync-offline",
            headers=headers,
            json={
                "trip_id": trip_id,
                "boardings": [
                    {
                        "ticket_id": second_ticket["ticket_id"],
                        "boarded_at": "2026-10-30T10:00:00Z",
                        "device_id": "offline-scanner-01"
                    }
                ]
            }
        )
        assert batch_res.status_code == 200
        batch_data = batch_res.json()
        assert batch_data["synced_count"] == 1
        assert batch_data["boarded_count"] == 2

        # 10. Conductor departs and completes trip
        depart_res = await client.post(f"/api/v1/conductor/trips/{trip_id}/depart", headers=headers)
        assert depart_res.status_code == 200
        assert depart_res.json()["status"] == "DEPARTED"

        complete_res = await client.post(f"/api/v1/conductor/trips/{trip_id}/complete", headers=headers)
        assert complete_res.status_code == 200
        assert complete_res.json()["status"] == "COMPLETED"


@pytest.mark.asyncio
async def test_demand_threshold_activation_and_operator_assignment():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Login Operator
        op_login = await client.post("/api/v1/auth/login", json={
            "email": "operator@railbus.com",
            "password": "password123"
        })
        assert op_login.status_code == 200
        op_token = op_login.json()["access_token"]
        op_headers = {"Authorization": f"Bearer {op_token}"}

        # Get existing route
        trips = (await client.get("/api/v1/trips")).json()
        route_id = trips[0]["route_id"]

        # Create new trip in AGGREGATING status
        create_res = await client.post("/api/v1/trips", headers=op_headers, json={
            "route_id": route_id,
            "base_fare": 60.0
        })
        assert create_res.status_code == 200
        new_trip = create_res.json()
        new_trip_id = new_trip["id"]
        assert new_trip["status"] == "AGGREGATING"
        assert new_trip["demand_count"] == 0
        assert new_trip["threshold_met"] is False

        # Login Passenger
        p_login = await client.post("/api/v1/auth/login", json={
            "email": "passenger1@example.com",
            "password": "password123"
        })
        p_token = p_login.json()["access_token"]
        p_headers = {"Authorization": f"Bearer {p_token}"}

        # Passenger makes a booking for 19 seats (still under 20)
        bk1 = (await client.post("/api/v1/bookings", headers=p_headers, json={
            "trip_id": new_trip_id,
            "seat_count": 9
        })).json()
        await client.post("/api/v1/bookings/simulate-payment", headers=p_headers, json={
            "booking_id": bk1["id"],
            "idempotency_key": "idem-1"
        })

        bk2 = (await client.post("/api/v1/bookings", headers=p_headers, json={
            "trip_id": new_trip_id,
            "seat_count": 10
        })).json()
        await client.post("/api/v1/bookings/simulate-payment", headers=p_headers, json={
            "booking_id": bk2["id"],
            "idempotency_key": "idem-2"
        })

        # Check trip status: should still be AGGREGATING (19 bookings)
        trip_check = (await client.get(f"/api/v1/trips/{new_trip_id}")).json()
        assert trip_check["demand_count"] == 19
        assert trip_check["status"] == "AGGREGATING"
        assert trip_check["threshold_met"] is False

        # Attempt operator assignment before threshold should fail
        assign_attempt = await client.post(
            f"/api/v1/trips/{new_trip_id}/assign",
            headers=op_headers,
            json={"bus_id": "any-bus", "conductor_id": "any-conductor"}
        )
        assert assign_attempt.status_code == 400
        assert assign_attempt.json()["code"] == "THRESHOLD_NOT_MET"

        # Passenger makes booking #20 -> reaches activation threshold!
        bk3 = (await client.post("/api/v1/bookings", headers=p_headers, json={
            "trip_id": new_trip_id,
            "seat_count": 1
        })).json()
        await client.post("/api/v1/bookings/simulate-payment", headers=p_headers, json={
            "booking_id": bk3["id"],
            "idempotency_key": "idem-3"
        })

        # Check trip status: should automatically transition to THRESHOLD_MET!
        trip_check_20 = (await client.get(f"/api/v1/trips/{new_trip_id}")).json()
        assert trip_check_20["demand_count"] == 20
        assert trip_check_20["status"] == "THRESHOLD_MET"
        assert trip_check_20["threshold_met"] is True
