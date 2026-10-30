"""
RailBus Intelligence Engine - Demand Models Layer
Encapsulates Model A (Train Arrival Forecast) and Model B (Bus Demand Forecast).
Provides point estimates (P50) and calibrated confidence intervals (P10 - P90).
"""
import os
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from engine.feature_engineering import FeatureEngineeringLayer

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")


class DemandForecaster:
    """Inference engine for Model A (Arrival) and Model B (Bus Demand)."""

    def __init__(self, models_dir: str = MODELS_DIR):
        self.models_dir = models_dir
        
        # Model A pipelines
        self.model_a_p50 = joblib.load(os.path.join(models_dir, "arrival_forecaster.joblib"))
        self.model_a_p10 = joblib.load(os.path.join(models_dir, "arrival_forecaster_p10.joblib"))
        self.model_a_p90 = joblib.load(os.path.join(models_dir, "arrival_forecaster_p90.joblib"))
        
        # Model B pipelines
        self.model_b_p50 = joblib.load(os.path.join(models_dir, "bus_demand_forecaster.joblib"))
        self.model_b_p10 = joblib.load(os.path.join(models_dir, "bus_demand_forecaster_p10.joblib"))
        self.model_b_p90 = joblib.load(os.path.join(models_dir, "bus_demand_forecaster_p90.joblib"))

    def predict_model_a(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Model A: Predicts total passengers alighting at Mysuru railway station.
        Returns expected count (P50) and 80% confidence interval (P10, P90).
        """
        df_a = FeatureEngineeringLayer.prepare_model_a_input(event_data)
        
        p50 = float(np.maximum(0, self.model_a_p50.predict(df_a)[0]))
        p10 = float(np.maximum(0, self.model_a_p10.predict(df_a)[0]))
        p90 = float(np.maximum(p50, self.model_a_p90.predict(df_a)[0]))

        return {
            "model": "Model A - Train Alighting Forecast",
            "target": "alighting_passengers_at_mysuru",
            "expected_alighting": round(p50, 1),
            "lower_bound_p10": round(p10, 1),
            "upper_bound_p90": round(p90, 1),
            "interval_spread": round(p90 - p10, 1),
            "confidence_level": "80%"
        }

    def predict_model_b(
        self,
        event_data: Dict[str, Any],
        route_snapshots: List[Dict[str, Any]],
        snapshot_horizon: float = 2.0
    ) -> List[Dict[str, Any]]:
        """
        Model B: Predicts final RailBus passenger count per destination route.
        Returns route-wise point predictions, confidence intervals, and booking velocity.
        """
        if not route_snapshots:
            return []

        df_b = FeatureEngineeringLayer.prepare_model_b_inputs(event_data, route_snapshots, snapshot_horizon)
        
        preds_p50 = np.maximum(0, self.model_b_p50.predict(df_b))
        preds_p10 = np.maximum(0, self.model_b_p10.predict(df_b))
        preds_p90 = np.maximum(preds_p50, self.model_b_p90.predict(df_b))

        results = []
        for i, row in enumerate(route_snapshots):
            dest = row.get("destination_station", "Unknown")
            curr_b = int(row.get("current_confirmed_bookings", 0))
            interest = int(row.get("passengers_submitted_interest", 0))
            p50 = float(preds_p50[i])
            p10 = float(preds_p10[i])
            p90 = float(preds_p90[i])
            
            # Real-world constraint: predicted demand can never be lower than already confirmed bookings
            expected = max(curr_b, round(p50, 1))
            upper = max(expected, round(p90, 1))
            lower = max(curr_b, round(p10, 1))

            results.append({
                "destination_station": dest,
                "snapshot_hours_before_arrival": snapshot_horizon,
                "current_confirmed_bookings": curr_b,
                "passengers_submitted_interest": interest,
                "historical_route_demand": float(row.get("historical_route_demand_synthetic", 0.0)),
                "booking_growth_rate": float(row.get("booking_growth_last_hour_synthetic", 0.0)),
                "predicted_passengers": expected,
                "lower_bound_p10": lower,
                "upper_bound_p90": upper,
                "demand_spread": round(upper - lower, 1),
                "actual_synthetic": row.get("final_railbus_passengers_actual_synthetic")
            })

        return results
