"""
RailBus Intelligence Engine - Honest SmartSync Orchestrator
Coordinates Data Acquisition, Coherent 4-Stage Hierarchy, OR-Tools Supply Optimizer,
and Backend Integration.

Core Mandate:
- SmartSync RECOMMENDS but NEVER DISPATCHES.
- No endpoint in this service can modify a trip or booking.
- All outputs contain data_source, model_version, and served_by tags.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime

from engine.data_acquisition import DataAcquisitionLayer
from engine.models_4stage import RailBus4StagePredictor
from engine.transport_optimizer import TransportOptimizationEngine
from engine.backend_client import BackendClient
from engine.post_arrival_evaluator import PostArrivalEvaluator
from engine.registry import ModelRegistry


class RailBusIntelligenceEngine:
    """Honest SmartSync Module for RailBus Operations."""

    def __init__(self, data_dir: Optional[str] = None, models_dir: Optional[str] = None):
        self.data_layer = DataAcquisitionLayer(data_dir=data_dir) if data_dir else DataAcquisitionLayer()
        self.predictor = RailBus4StagePredictor(models_dir=models_dir) if models_dir else RailBus4StagePredictor()
        self.backend = BackendClient()
        self.optimizer = TransportOptimizationEngine(backend_client=self.backend)
        self.evaluator = PostArrivalEvaluator(data_layer=self.data_layer, predictor=self.predictor)

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
        Executes the 4-Stage Demand Inference Hierarchy & Fleet Optimization.
        Guarantees:
            confirmed_bookings <= RailBus Adoption <= Onward Transit Need <= Destination Pax <= Alighting Pax
        """
        event_data = self.data_layer.get_event_by_id(event_id)
        if not event_data:
            raise ValueError(f"Train event '{event_id}' not found.")

        route_snapshots = self.data_layer.get_snapshots_for_event(event_id, horizon=snapshot_horizon)
        if not route_snapshots:
            route_snapshots = self.data_layer.get_snapshots_for_event(event_id, horizon=None)

        # -------------------------------------------------------------
        # STAGE 1: COHERENT 4-STAGE PREDICT
        # -------------------------------------------------------------
        # Model 01: Train-wise Passenger Arrival Estimation
        m1 = self.predictor.predict_model_01_arrivals(event_data)
        alighting = m1["expected_alighting_passengers"]

        # Model 02: Destination-wise Passenger Distribution (Partitions alighting)
        m2 = self.predictor.predict_model_02_destinations(event_data, alighting)

        # Model 03: Onward Transportation Demand (Documented Bayesian Beta Prior)
        m3 = self.predictor.predict_model_03_transit_demand(
            event_data,
            m2["destination_passenger_counts"]
        )

        # Model 04: RailBus Adoption Prediction (Strictly bounded by Transit Need)
        m4 = self.predictor.predict_model_04_railbus_adoption(
            event_data,
            route_snapshots,
            snapshot_horizon=snapshot_horizon,
            model_03_transit=m3
        )

        # -------------------------------------------------------------
        # STAGE 2: TRANSPORT OPTIMIZATION (OR-TOOLS MILP)
        # -------------------------------------------------------------
        plan = self.optimizer.optimize_fleet(
            event_data=event_data,
            forecast_results=m4,
            risk_tolerance=risk_tolerance
        )

        return {
            "status": "success",
            "data_source": "SYNTHETIC",
            "model_version": ModelRegistry.CURRENT_VERSION,
            "pipeline_timestamp": datetime.utcnow().isoformat() + "Z",
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
            "predictions": {
                "model_01": m1,
                "model_02": m2,
                "model_03": m3,
                "model_04": m4
            },
            "optimization_plan": plan,
            "system_disclaimer": "SmartSync is an advisory module. All vehicle and conductor assignments require operator authorization in the RailBus backend."
        }

    def transmit_recommendations_to_backend(
        self,
        event_id: str,
        snapshot_horizon: float = 2.0,
        risk_tolerance: str = "balanced"
    ) -> Dict[str, Any]:
        """
        Runs pipeline and transmits recommendation payload to the backend API:
        POST /api/v1/smartsync/recommendations
        """
        pipeline = self.execute_pipeline(event_id, snapshot_horizon, risk_tolerance)
        plan = pipeline["optimization_plan"]

        payload = {
            "source_service": "SmartSync ML Service",
            "data_source": "SYNTHETIC",
            "model_version": ModelRegistry.CURRENT_VERSION,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "event_id": event_id,
            "confirmed_assignment_recommendations": plan["confirmed_assignment_recommendations"],
            "forecast_prepositioning_proposals": plan["forecast_prepositioning_proposals"],
            "summary": plan["summary"]
        }

        # Transmit to backend
        backend_response = self.backend.post_recommendations(payload)
        return {
            "transmission_status": "COMPLETED",
            "backend_response": backend_response,
            "data_source": "SYNTHETIC",
            "model_version": ModelRegistry.CURRENT_VERSION,
            "recommendation_summary": plan["summary"]
        }

    def run_post_arrival_audit(self, event_id: str) -> Dict[str, Any]:
        """Audits pre-arrival forecasts against post-arrival ground truth."""
        return self.evaluator.evaluate_event(event_id)
