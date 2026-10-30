"""
RailBus Intelligence Engine - Data Processing & Feature Engineering Layer
Performs train-wise, station-wise and time-window aggregations and preparation
for Model A (Train Arrival Forecast) and Model B (Bus Demand Forecast).
"""
from typing import Dict, Any, List
import pandas as pd
import numpy as np


class FeatureEngineeringLayer:
    """Prepares structured feature matrices from operational inputs."""

    MODEL_A_FEATURES = [
        "train_id", "origin_station", "train_type", "arrival_hour",
        "day_of_week", "is_weekend", "is_holiday_synthetic",
        "festival_period_synthetic", "month", "peak_season", "weather_synthetic"
    ]

    MODEL_B_FEATURES = [
        "snapshot_hours_before_arrival", "train_id", "origin_station", "destination_station",
        "train_type", "arrival_hour", "day_of_week", "is_weekend",
        "is_holiday_synthetic", "festival_period_synthetic", "month",
        "weather_synthetic", "current_confirmed_bookings",
        "passengers_submitted_interest", "booking_growth_last_hour_synthetic",
        "historical_route_demand_synthetic"
    ]

    @staticmethod
    def prepare_model_a_input(event_data: Dict[str, Any]) -> pd.DataFrame:
        """Constructs a 1-row DataFrame matching Model A feature requirements."""
        row = {}
        for feat in FeatureEngineeringLayer.MODEL_A_FEATURES:
            val = event_data.get(feat)
            if feat in ["arrival_hour", "day_of_week", "is_weekend", "is_holiday_synthetic",
                        "festival_period_synthetic", "month", "peak_season"]:
                row[feat] = int(val) if val is not None else 0
            else:
                row[feat] = str(val) if val is not None else "Unknown"
        return pd.DataFrame([row])

    @staticmethod
    def prepare_model_b_inputs(
        event_data: Dict[str, Any],
        route_snapshots: List[Dict[str, Any]],
        snapshot_horizon: float = 2.0
    ) -> pd.DataFrame:
        """Constructs multi-row DataFrame matching Model B feature requirements for each route."""
        rows = []
        for r in route_snapshots:
            row = {}
            # Inherit common event data
            for col in ["train_id", "origin_station", "train_type", "arrival_hour",
                        "day_of_week", "is_weekend", "is_holiday_synthetic",
                        "festival_period_synthetic", "month", "weather_synthetic"]:
                row[col] = r.get(col, event_data.get(col))

            # Destination & Snapshot fields
            row["snapshot_hours_before_arrival"] = float(r.get("snapshot_hours_before_arrival", snapshot_horizon))
            row["destination_station"] = str(r.get("destination_station", "Other"))
            row["current_confirmed_bookings"] = int(r.get("current_confirmed_bookings", 0))
            row["passengers_submitted_interest"] = int(r.get("passengers_submitted_interest", 0))
            row["booking_growth_last_hour_synthetic"] = float(r.get("booking_growth_last_hour_synthetic", 0.0))
            row["historical_route_demand_synthetic"] = float(r.get("historical_route_demand_synthetic", 5.0))
            rows.append(row)

        df = pd.DataFrame(rows)
        # Ensure column ordering matches training
        return df[FeatureEngineeringLayer.MODEL_B_FEATURES]
