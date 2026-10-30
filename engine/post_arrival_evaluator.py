"""
RailBus Intelligence Engine - Post-Arrival Evaluation Job
Audits pre-arrival predictions against actual observed counts after train arrival.
Logs residuals, accuracy, and interval coverage to track model drift and calibration.
"""
import os
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
import pandas as pd

from engine.data_acquisition import DataAcquisitionLayer
from engine.models_4stage import RailBus4StagePredictor
from engine.registry import ModelRegistry

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVAL_DIR = os.path.join(BASE_DIR, "models", "evaluation")
os.makedirs(EVAL_DIR, exist_ok=True)
AUDIT_LOG_FILE = os.path.join(EVAL_DIR, "post_arrival_log.json")


class PostArrivalEvaluator:
    """Post-arrival auditing job comparing forecasts vs actuals."""

    def __init__(self, data_layer: Optional[DataAcquisitionLayer] = None, predictor: Optional[RailBus4StagePredictor] = None):
        self.data_layer = data_layer or DataAcquisitionLayer()
        self.predictor = predictor or RailBus4StagePredictor()

    def evaluate_event(self, event_id: str) -> Dict[str, Any]:
        """
        Runs post-arrival evaluation for an event:
        Compares Model 01 & Model 04 forecasts across horizons vs ground truth actuals.
        """
        event = self.data_layer.get_event_by_id(event_id)
        if not event:
            raise ValueError(f"Event ID {event_id} not found")

        # Ground truth actuals
        actual_alighting = int(event.get("alighting_passengers_actual_synthetic", 0))

        # Model 01 Forecast
        m1 = self.predictor.predict_model_01_arrivals(event)
        pred_alighting = m1["expected_alighting_passengers"]
        m1_error = abs(actual_alighting - pred_alighting)
        m1_ape = round((m1_error / max(1, actual_alighting)) * 100, 1)
        m1_in_interval = m1["lower_bound_p10"] <= actual_alighting <= m1["upper_bound_p90"]

        # Horizon evaluations for Model 04
        horizon_comparisons = []
        for h in [24.0, 6.0, 2.0, 0.5]:
            snaps = self.data_layer.get_snapshots_for_event(event_id, horizon=h)
            if not snaps:
                continue

            m2 = self.predictor.predict_model_02_destinations(event, pred_alighting)
            m3 = self.predictor.predict_model_03_transit_demand(event, m2["destination_passenger_counts"])
            m4 = self.predictor.predict_model_04_railbus_adoption(event, snaps, h, m3)

            # Route breakdown
            route_audits = []
            for s, r in zip(snaps, m4["route_breakdown"]):
                actual_rb = int(s.get("final_railbus_passengers_actual_synthetic", 0))
                pred_rb = r["expected_railbus_passengers"]
                err = abs(actual_rb - pred_rb)
                in_range = r["lower_bound_p10"] <= actual_rb <= r["upper_bound_p90"]
                route_audits.append({
                    "destination": r["destination_station"],
                    "predicted": pred_rb,
                    "actual": actual_rb,
                    "absolute_error": err,
                    "in_80pct_range": in_range
                })

            total_pred = sum(ra["predicted"] for ra in route_audits)
            total_act = sum(ra["actual"] for ra in route_audits)
            horizon_comparisons.append({
                "horizon_hours": h,
                "predicted_total": total_pred,
                "actual_total": total_act,
                "total_error": abs(total_act - total_pred),
                "routes": route_audits
            })

        audit_record = {
            "audit_id": f"AUDIT-{event_id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "event_id": event_id,
            "train_id": event.get("train_id"),
            "data_source": "SYNTHETIC",
            "model_version": ModelRegistry.CURRENT_VERSION,
            "evaluated_at": datetime.utcnow().isoformat() + "Z",
            "model_01_audit": {
                "served_by": m1["served_by"],
                "is_baseline": m1["is_baseline"],
                "predicted_alighting": pred_alighting,
                "actual_alighting": actual_alighting,
                "absolute_error": m1_error,
                "percentage_error": m1_ape,
                "within_80pct_interval": m1_in_interval,
                "interval": m1["confidence_interval_80pct"]
            },
            "model_04_horizon_audits": horizon_comparisons
        }

        # Append to log
        logs = []
        if os.path.exists(AUDIT_LOG_FILE):
            try:
                with open(AUDIT_LOG_FILE, "r") as f:
                    logs = json.load(f)
            except Exception:
                logs = []

        logs.append(audit_record)
        # Keep last 100 audit records
        if len(logs) > 100:
            logs = logs[-100:]

        with open(AUDIT_LOG_FILE, "w") as f:
            json.dump(logs, f, indent=2)

        return audit_record
