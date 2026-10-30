"""
RailBus Intelligence Engine - Master Orchestrator
Binds the 4-Stage Demand Inference Architecture (Model 01, 02, 03, 04)
and the OR-Tools Transport Optimization Engine into the "Predict -> Plan -> Deploy" workflow.
"""
import os
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime

from engine.data_acquisition import DataAcquisitionLayer
from engine.models_4stage import RailBus4StagePredictor
from engine.transport_optimizer import TransportOptimizationEngine


class RailBusIntelligenceEngine:
    """Master controller for RailBus Intelligence Platform."""

    def __init__(self, data_dir: Optional[str] = None, models_dir: Optional[str] = None):
        self.data_layer = DataAcquisitionLayer(data_dir=data_dir) if data_dir else DataAcquisitionLayer()
        self.predictor = RailBus4StagePredictor(models_dir=models_dir) if models_dir else RailBus4StagePredictor()
        self.optimizer = TransportOptimizationEngine()
        self.deployed_manifests: Dict[str, Dict[str, Any]] = {}

    def get_upcoming_trains(self, limit: int = 50) -> List[Dict[str, Any]]:
        """List incoming train arrival events."""
        return self.data_layer.get_all_train_events(limit=limit)

    def execute_pipeline(
        self,
        event_id: str,
        snapshot_horizon: float = 2.0,
        risk_tolerance: str = "balanced"
    ) -> Dict[str, Any]:
        """
        Executes the full Predict -> Plan pipeline for an incoming train event:
        Stage 1: PREDICT (Model 01, Model 02, Model 03, Model 04)
        Stage 2: PLAN (OR-Tools Transport Optimization Engine: capacity, grouping, timing)
        Stage 3: Ready for DEPLOY
        """
        event_data = self.data_layer.get_event_by_id(event_id)
        if not event_data:
            raise ValueError(f"Train event '{event_id}' not found.")

        route_snapshots = self.data_layer.get_snapshots_for_event(event_id, horizon=snapshot_horizon)
        if not route_snapshots:
            route_snapshots = self.data_layer.get_snapshots_for_event(event_id, horizon=None)

        # -------------------------------------------------------------
        # STAGE 1: PREDICT (4 DISTINCT MODELS)
        # -------------------------------------------------------------
        # Model 01: Train-wise Passenger Arrival Estimation
        m1_arrival = self.predictor.predict_model_01_arrivals(event_data)
        alighting_count = m1_arrival["expected_alighting_passengers"]

        # Model 02: Destination-wise Passenger Distribution
        m2_destinations = self.predictor.predict_model_02_destinations(event_data, alighting_count)

        # Model 03: Onward Transportation Demand
        m3_transit = self.predictor.predict_model_03_transit_demand(
            event_data,
            m2_destinations["destination_passenger_counts"]
        )

        # Model 04: RailBus Adoption Prediction
        m4_adoption = self.predictor.predict_model_04_railbus_adoption(
            event_data,
            route_snapshots,
            snapshot_horizon=snapshot_horizon,
            model_03_transit=m3_transit
        )

        # -------------------------------------------------------------
        # STAGE 2: PLAN (OR-TOOLS TRANSPORT OPTIMIZATION ENGINE)
        # -------------------------------------------------------------
        plan = self.optimizer.optimize_transport_plan(
            event_data=event_data,
            model_04_results=m4_adoption,
            risk_tolerance=risk_tolerance
        )

        # Deployment check
        is_deployed = event_id in self.deployed_manifests

        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "event_id": event_id,
            "train_info": {
                "train_id": event_data.get("train_id"),
                "train_name": event_data.get("train_name_synthetic"),
                "origin_station": event_data.get("origin_station"),
                "destination_station": event_data.get("destination_station"),
                "train_type": event_data.get("train_type"),
                "scheduled_arrival": event_data.get("scheduled_arrival"),
                "actual_delay_minutes": event_data.get("arrival_delay_minutes"),
                "weather": event_data.get("weather_synthetic"),
                "is_holiday": bool(event_data.get("is_holiday_synthetic")),
                "festival_period": bool(event_data.get("festival_period_synthetic")),
                "peak_season": bool(event_data.get("peak_season"))
            },
            "snapshot_horizon_hours": snapshot_horizon,
            "stage_1_predict": {
                "model_01_arrival_estimation": m1_arrival,
                "model_02_destination_distribution": m2_destinations,
                "model_03_transit_demand": m3_transit,
                "model_04_railbus_adoption": m4_adoption
            },
            "stage_2_plan": plan,
            "stage_3_deploy": {
                "status": "DEPLOYED" if is_deployed else "READY_FOR_DEPLOYMENT",
                "deployment_record": self.deployed_manifests.get(event_id)
            }
        }

    def deploy_manifest(
        self,
        event_id: str,
        operator_name: str,
        notes: str = "",
        custom_route_overrides: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Executes the 'DEPLOY' action in Predict -> Plan -> Deploy.
        Signs and issues official digital dispatch manifest.
        """
        pipeline = self.execute_pipeline(event_id)
        manifest_id = f"RBM-{event_id}-{str(uuid.uuid4())[:8].upper()}"

        record = {
            "manifest_id": manifest_id,
            "event_id": event_id,
            "operator_name": operator_name,
            "deployment_timestamp": datetime.utcnow().isoformat() + "Z",
            "notes": notes,
            "overrides": custom_route_overrides or {},
            "timing": pipeline["stage_2_plan"]["timing"],
            "fleet_summary": pipeline["stage_2_plan"]["fleet_summary"],
            "route_plans": pipeline["stage_2_plan"]["route_plans"],
            "status": "OFFICIALLY_DEPLOYED"
        }
        self.deployed_manifests[event_id] = record
        return record

    def simulate_scenario(
        self,
        event_id: str,
        delay_minutes_delta: int = 0,
        booking_growth_multiplier: float = 1.0,
        festival_surge_multiplier: float = 1.0,
        risk_tolerance: str = "balanced"
    ) -> Dict[str, Any]:
        """
        What-if scenario simulator:
        Runs simulated operational stresses through all 4 models and OR-Tools optimization.
        """
        event_data = self.data_layer.get_event_by_id(event_id)
        if not event_data:
            raise ValueError(f"Event ID '{event_id}' not found.")

        sim_event = dict(event_data)
        curr_delay = int(sim_event.get("arrival_delay_minutes", 0))
        sim_event["arrival_delay_minutes"] = max(0, curr_delay + delay_minutes_delta)
        
        route_snapshots = self.data_layer.get_snapshots_for_event(event_id, horizon=2.0)
        sim_snapshots = []
        for s in route_snapshots:
            s_copy = dict(s)
            s_copy["current_confirmed_bookings"] = int(s_copy["current_confirmed_bookings"] * booking_growth_multiplier)
            s_copy["passengers_submitted_interest"] = int(s_copy["passengers_submitted_interest"] * booking_growth_multiplier)
            s_copy["historical_route_demand_synthetic"] = float(s_copy["historical_route_demand_synthetic"] * festival_surge_multiplier)
            sim_snapshots.append(s_copy)

        # Run 4 models on simulated data
        m1 = self.predictor.predict_model_01_arrivals(sim_event)
        m2 = self.predictor.predict_model_02_destinations(sim_event, m1["expected_alighting_passengers"])
        m3 = self.predictor.predict_model_03_transit_demand(sim_event, m2["destination_passenger_counts"])
        m4 = self.predictor.predict_model_04_railbus_adoption(sim_event, sim_snapshots, 2.0, m3)
        plan = self.optimizer.optimize_transport_plan(sim_event, m4, risk_tolerance=risk_tolerance)

        return {
            "simulation_parameters": {
                "delay_minutes_delta": delay_minutes_delta,
                "booking_growth_multiplier": booking_growth_multiplier,
                "festival_surge_multiplier": festival_surge_multiplier,
                "risk_tolerance": risk_tolerance
            },
            "stage_1_predict": {
                "model_01": m1,
                "model_02": m2,
                "model_03": m3,
                "model_04": m4
            },
            "stage_2_plan": plan
        }
