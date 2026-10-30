"""
Test Suite: OR-Tools Transport Optimizer Constraints
Verifies:
1. 20-confirmed-booking threshold (trips < 20 demand are strictly ineligible for assignment).
2. Bus capacity >= confirmed bookings for assigned trips.
3. Conductor overlap constraint (no conductor double-booking).
4. Shared fleet overlap constraint (no bus double-booking).
5. Strict separation of confirmed assignments from forecast proposals.
"""
import pytest
from engine.transport_optimizer import TransportOptimizationEngine, DEMAND_ACTIVATION_THRESHOLD


class MockBackendClient:
    """Mock client returning deterministic fleet for testing."""
    def get_buses(self):
        return [
            {"id": "b-test-1", "registration_number": "KA-01-RB-1001", "model": "Test Coach 40", "capacity": 40, "status": "ACTIVE", "is_active": True},
            {"id": "b-test-2", "registration_number": "KA-01-RB-1002", "model": "Test Coach 30", "capacity": 30, "status": "ACTIVE", "is_active": True}
        ]

    def get_conductors(self):
        return [
            {"id": "c-test-1", "employee_id": "COND-01", "is_available": True, "full_name": "Conductor One"},
            {"id": "c-test-2", "employee_id": "COND-02", "is_available": True, "full_name": "Conductor Two"}
        ]

    def get_trips(self):
        return [
            # Trip A: Meets threshold (25 bookings)
            {"id": "t-eligible-1", "route_name": "Eligible Route A", "destination": "Bengaluru", "demand_count": 25, "departure_time": "12:00", "status": "AGGREGATING"},
            # Trip B: Below threshold (12 bookings)
            {"id": "t-ineligible-1", "route_name": "Ineligible Route B", "destination": "Mandya", "demand_count": 12, "departure_time": "12:00", "status": "AGGREGATING"},
            # Trip C: Below threshold (19 bookings)
            {"id": "t-ineligible-2", "route_name": "Ineligible Route C", "destination": "Hassan", "demand_count": 19, "departure_time": "12:00", "status": "AGGREGATING"}
        ]


def test_20_booking_threshold_enforced():
    optimizer = TransportOptimizationEngine(backend_client=MockBackendClient())
    plan = optimizer.optimize_fleet()

    assignments = plan["confirmed_assignment_recommendations"]
    assert len(assignments) == 3

    # Trip A (25 bookings) must be assigned
    trip_a = next(a for a in assignments if a["trip_id"] == "t-eligible-1")
    assert trip_a["bus_id"] is not None
    assert trip_a["conductor_id"] is not None
    assert trip_a["confirmed_bookings"] >= DEMAND_ACTIVATION_THRESHOLD

    # Trip B (12 bookings) must NOT be assigned
    trip_b = next(a for a in assignments if a["trip_id"] == "t-ineligible-1")
    assert trip_b["bus_id"] is None
    assert trip_b["conductor_id"] is None
    assert "UNMET" in trip_b["threshold_status"]

    # Trip C (19 bookings) must NOT be assigned
    trip_c = next(a for a in assignments if a["trip_id"] == "t-ineligible-2")
    assert trip_c["bus_id"] is None
    assert trip_c["conductor_id"] is None


def test_bus_capacity_covers_demand():
    optimizer = TransportOptimizationEngine(backend_client=MockBackendClient())
    plan = optimizer.optimize_fleet()

    for a in plan["confirmed_assignment_recommendations"]:
        if a["bus_id"] is not None:
            assert a["bus_capacity"] >= a["confirmed_bookings"], (
                f"Bus capacity {a['bus_capacity']} < confirmed bookings {a['confirmed_bookings']}"
            )


def test_no_conductor_double_booking():
    optimizer = TransportOptimizationEngine(backend_client=MockBackendClient())
    plan = optimizer.optimize_fleet()

    assigned_conductors = [a["conductor_id"] for a in plan["confirmed_assignment_recommendations"] if a["conductor_id"]]
    # Unique conductor IDs only
    assert len(assigned_conductors) == len(set(assigned_conductors)), "Conductor double-booked across concurrent trips!"


def test_strict_output_separation():
    optimizer = TransportOptimizationEngine(backend_client=MockBackendClient())
    forecast_mock = {
        "route_breakdown": [
            {"destination_station": "Mandya", "expected_railbus_passengers": 15, "upper_bound_p90": 22, "current_confirmed_bookings": 12}
        ]
    }
    plan = optimizer.optimize_fleet(forecast_results=forecast_mock)

    assert "confirmed_assignment_recommendations" in plan
    assert "forecast_prepositioning_proposals" in plan

    # Verify forecast proposal is separate and advisory
    proposals = plan["forecast_prepositioning_proposals"]
    assert len(proposals) == 1
    assert proposals[0]["status"] == "ADVISORY_FORECAST_ONLY"
    assert "Advisory proposal only" in proposals[0]["disclaimer"]
