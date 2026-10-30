"""
Test Suite: Hierarchical Coherence Constraints
Verifies that:
    confirmed_bookings <= RailBus Adoption <= Onward Transit Need <= Destination Pax <= Alighting Pax
holds strictly across edge cases (zero demand, high surge, boundary conditions).
"""
import pytest
from engine.data_acquisition import DataAcquisitionLayer
from engine.models_4stage import RailBus4StagePredictor


@pytest.fixture(scope="module")
def predictor_and_data():
    dl = DataAcquisitionLayer()
    pred = RailBus4StagePredictor()
    return dl, pred


def test_coherence_standard_event(predictor_and_data):
    dl, pred = predictor_and_data
    event = dl.get_event_by_id("EVT00001")
    assert event is not None

    for horizon in [24.0, 6.0, 2.0, 0.5]:
        snaps = dl.get_snapshots_for_event("EVT00001", horizon=horizon)
        
        m1 = pred.predict_model_01_arrivals(event)
        m2 = pred.predict_model_02_destinations(event, m1["expected_alighting_passengers"])
        m3 = pred.predict_model_03_transit_demand(event, m2["destination_passenger_counts"])
        m4 = pred.predict_model_04_railbus_adoption(event, snaps, horizon, m3)

        A = m1["expected_alighting_passengers"]
        D_sum = sum(m2["destination_passenger_counts"].values())
        N = m3["total_onward_transit_demand"]
        R = m4["total_expected_railbus_passengers"]
        B = m4["total_confirmed_bookings"]

        # Destination sum exactly partitions alighting
        assert D_sum == A, f"Destination sum {D_sum} != Alighting {A}"
        
        # Hierarchy: B <= R <= N <= A
        assert B <= R, f"Confirmed bookings {B} > RailBus adoption {R}"
        assert R <= N, f"RailBus adoption {R} > Transit need {N}"
        assert N <= A, f"Transit need {N} > Alighting {A}"

        # Per route coherence
        for r in m4["route_breakdown"]:
            dest = r["destination_station"]
            dest_pax = m2["destination_passenger_counts"][dest]
            t_need = m3["destination_breakdown"][dest]["onward_transit_passengers"]
            r_adopt = r["expected_railbus_passengers"]
            b_conf = r["current_confirmed_bookings"]

            assert b_conf <= r_adopt <= t_need <= dest_pax, (
                f"Route {dest} coherence failure: Confirmed({b_conf}) <= Adoption({r_adopt}) <= "
                f"TransitNeed({t_need}) <= DestPax({dest_pax})"
            )


def test_coherence_zero_demand_boundary(predictor_and_data):
    dl, pred = predictor_and_data
    fake_event = {
        "event_id": "EVT-ZERO",
        "train_id": "TR-000",
        "origin_station": "Unknown",
        "train_type": "Passenger",
        "arrival_hour": 12,
        "day_of_week": 1,
        "is_weekend": 0,
        "is_holiday_synthetic": 0,
        "festival_period_synthetic": 0,
        "month": 6,
        "peak_season": 0,
        "weather_synthetic": "Clear"
    }
    
    # Empty alighting
    m2 = pred.predict_model_02_destinations(fake_event, 0)
    assert sum(m2["destination_passenger_counts"].values()) == 0

    m3 = pred.predict_model_03_transit_demand(fake_event, m2["destination_passenger_counts"])
    assert m3["total_onward_transit_demand"] == 0

    fake_snaps = [
        {"destination_station": "Bengaluru", "current_confirmed_bookings": 0, "passengers_submitted_interest": 0, "snapshot_hours_before_arrival": 2.0}
    ]
    m4 = pred.predict_model_04_railbus_adoption(fake_event, fake_snaps, 2.0, m3)
    assert m4["total_expected_railbus_passengers"] == 0
