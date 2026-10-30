"""
RailBus Intelligence Engine - 4-Stage Demand Inference Architecture
Implements the 4 distinct prediction targets:
- Model 01: Train-wise Passenger Arrival Estimation
- Model 02: Destination-wise Passenger Distribution
- Model 03: Onward Transportation Demand Estimation
- Model 04: RailBus Adoption Prediction
"""
import os
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")


class RailBus4StagePredictor:
    """Manages the 4 distinct prediction models without conflating targets."""

    def __init__(self, models_dir: str = MODELS_DIR):
        self.models_dir = models_dir
        self.m1_pkg = joblib.load(os.path.join(models_dir, "model_01_arrival_forecaster.joblib"))
        self.m2_pkg = joblib.load(os.path.join(models_dir, "model_02_destination_distribution.joblib"))
        self.m3_pkg = joblib.load(os.path.join(models_dir, "model_03_transit_demand.joblib"))
        self.m4_pkg = joblib.load(os.path.join(models_dir, "model_04_adoption_forecaster.joblib"))

    # -------------------------------------------------------------
    # Model 01: Train-wise Passenger Arrival Estimation
    # -------------------------------------------------------------
    def predict_model_01_arrivals(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Model 01: How many passengers will get down at Mysuru from each incoming train?
        Returns XGBoost prediction, count baseline benchmark, and 80% interval.
        """
        feats = self.m1_pkg["features"]
        cat_cols = self.m1_pkg["categorical_cols"]
        row = {}
        for f in feats:
            val = event_data.get(f)
            if f in cat_cols:
                row[f] = str(val) if val is not None else "Unknown"
            else:
                row[f] = float(val) if val is not None else 0.0

        df_in = pd.DataFrame([row])
        X_proc = self.m1_pkg["preprocessor"].transform(df_in)
        
        xgb_val = float(np.maximum(0, self.m1_pkg["primary_model"].predict(X_proc)[0]))
        poisson_val = float(np.maximum(0, self.m1_pkg["baseline_model"].predict(X_proc)[0]))
        p10_val = float(np.maximum(0, self.m1_pkg["p10_model"].predict(X_proc)[0]))
        p90_val = float(np.maximum(xgb_val, self.m1_pkg["p90_model"].predict(X_proc)[0]))

        return {
            "model_id": "Model 01",
            "title": "Train-wise Passenger Arrival Estimation",
            "question": "How many passengers will get down at Mysuru from each incoming train?",
            "target": "alighting_passengers_actual_synthetic",
            "expected_alighting_passengers": int(round(xgb_val)),
            "poisson_baseline_benchmark": int(round(poisson_val)),
            "lower_bound_p10": int(round(p10_val)),
            "upper_bound_p90": int(round(p90_val)),
            "confidence_interval_80pct": [int(round(p10_val)), int(round(p90_val))],
            "methodology": "XGBoost Regressor benchmarked against Negative Binomial / Poisson Count GLM"
        }

    # -------------------------------------------------------------
    # Model 02: Destination-wise Passenger Distribution
    # -------------------------------------------------------------
    def predict_model_02_destinations(self, event_data: Dict[str, Any], total_alighting: int) -> Dict[str, Any]:
        """
        Model 02: Where will those passengers go after arriving?
        Returns destination distribution probabilities and passenger counts.
        """
        destinations = self.m2_pkg["destinations"]
        origin = event_data.get("origin_station", "Unknown")
        ttype = event_data.get("train_type", "Unknown")
        
        # Condition on origin station and train type if available, fallback to global mean
        origin_profile = self.m2_pkg["origin_profiles"].get(origin)
        ttype_profile = self.m2_pkg["train_type_profiles"].get(ttype)
        mean_profile = self.m2_pkg["mean_shares"]
        
        shares = {}
        for d in destinations:
            s_orig = origin_profile.get(d, mean_profile.get(d, 0.1)) if origin_profile else mean_profile.get(d, 0.1)
            s_type = ttype_profile.get(d, mean_profile.get(d, 0.1)) if ttype_profile else mean_profile.get(d, 0.1)
            shares[d] = 0.5 * s_orig + 0.5 * s_type

        # Normalize to 1.0
        tot = sum(shares.values())
        norm_shares = {k: v / tot for k, v in shares.items()}
        
        # Compute passenger counts per destination summing exactly to total_alighting
        pax_counts = {}
        allocated = 0
        sorted_dests = sorted(norm_shares.items(), key=lambda x: x[1], reverse=True)
        for i, (d, sh) in enumerate(sorted_dests):
            if i == len(sorted_dests) - 1:
                pax = max(0, total_alighting - allocated)
            else:
                pax = int(round(total_alighting * sh))
                allocated += pax
            pax_counts[d] = pax

        return {
            "model_id": "Model 02",
            "title": "Destination-wise Passenger Distribution",
            "question": "Where will those passengers go after arriving?",
            "destination_shares_pct": {k: round(v * 100, 1) for k, v in norm_shares.items()},
            "destination_passenger_counts": pax_counts,
            "total_accounted_passengers": sum(pax_counts.values())
        }

    # -------------------------------------------------------------
    # Model 03: Onward Transportation Demand
    # -------------------------------------------------------------
    def predict_model_03_transit_demand(
        self,
        event_data: Dict[str, Any],
        destination_passengers: Dict[str, int]
    ) -> Dict[str, Any]:
        """
        Model 03: How many passengers will need onward transportation, irrespective of whether they use RailBus?
        Separates passengers needing commercial onward transit from local/picked up passengers.
        """
        factors = self.m3_pkg["base_transit_need_factors"]
        weather = event_data.get("weather_synthetic", "Clear")
        arr_hour = int(event_data.get("arrival_hour", 12))
        
        w_mult = self.m3_pkg["weather_multipliers"].get(weather, 1.0)
        night_boost = self.m3_pkg["night_arrival_boost"] if (arr_hour >= 20 or arr_hour <= 6) else 0.0

        dest_transit_need = {}
        total_need = 0
        total_pax = 0

        for dest, count in destination_passengers.items():
            base_f = factors.get(dest, 0.50)
            eff_rate = min(0.98, max(0.20, (base_f + night_boost) * w_mult))
            needed_pax = int(round(count * eff_rate))
            dest_transit_need[dest] = {
                "destination_passengers": count,
                "transit_need_rate_pct": round(eff_rate * 100, 1),
                "onward_transit_passengers": needed_pax,
                "private_or_local_passengers": max(0, count - needed_pax)
            }
            total_need += needed_pax
            total_pax += count

        overall_rate = round((total_need / max(1, total_pax)) * 100, 1)

        return {
            "model_id": "Model 03",
            "title": "Onward Transportation Demand",
            "question": "How many passengers will need onward transportation, irrespective of whether they use RailBus?",
            "total_onward_transit_demand": total_need,
            "overall_transit_need_rate_pct": overall_rate,
            "total_private_or_local_passengers": max(0, total_pax - total_need),
            "destination_breakdown": dest_transit_need,
            "interpretation": f"{total_need} out of {total_pax} passengers ({overall_rate}%) require onward commercial/shared transport."
        }

    # -------------------------------------------------------------
    # Model 04: RailBus Adoption Prediction
    # -------------------------------------------------------------
    def predict_model_04_railbus_adoption(
        self,
        event_data: Dict[str, Any],
        route_snapshots: List[Dict[str, Any]],
        snapshot_horizon: float,
        model_03_transit: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Model 04: How many passengers are likely to choose RailBus?
        Predicts final RailBus customers per destination with XGBoost and booking velocity.
        """
        feats = self.m4_pkg["features"]
        cat_cols = self.m4_pkg["categorical_cols"]
        
        rows = []
        for r in route_snapshots:
            row = {}
            for col in feats:
                if col in cat_cols:
                    row[col] = str(r.get(col, event_data.get(col, "Unknown")))
                elif col == "snapshot_hours_before_arrival":
                    row[col] = float(snapshot_horizon)
                else:
                    row[col] = float(r.get(col, event_data.get(col, 0.0)))
            rows.append(row)

        df_in = pd.DataFrame(rows)
        X_proc = self.m4_pkg["preprocessor"].transform(df_in)
        
        preds_p50 = np.maximum(0, self.m4_pkg["primary_model"].predict(X_proc))
        preds_p10 = np.maximum(0, self.m4_pkg["p10_model"].predict(X_proc))
        preds_p90 = np.maximum(preds_p50, self.m4_pkg["p90_model"].predict(X_proc))

        route_results = []
        total_adopted = 0
        total_p10 = 0
        total_p90 = 0
        total_confirmed = 0

        for i, r in enumerate(route_snapshots):
            dest = r.get("destination_station", "Unknown")
            curr_b = int(r.get("current_confirmed_bookings", 0))
            interest = int(r.get("passengers_submitted_interest", 0))
            
            p50 = float(preds_p50[i])
            p10 = float(preds_p10[i])
            p90 = float(preds_p90[i])
            
            # Floor by already confirmed bookings
            expected = max(curr_b, int(round(p50)))
            low = max(curr_b, int(round(p10)))
            high = max(expected, int(round(p90)))
            
            # Context from Model 03
            transit_pool = model_03_transit["destination_breakdown"].get(dest, {}).get("onward_transit_passengers", expected)
            adoption_share = round((expected / max(1, transit_pool)) * 100, 1)

            route_results.append({
                "destination_station": dest,
                "snapshot_hours_before_arrival": snapshot_horizon,
                "expected_railbus_passengers": expected,
                "lower_bound_p10": low,
                "upper_bound_p90": high,
                "confidence_range": [low, high],
                "current_confirmed_bookings": curr_b,
                "passengers_submitted_interest": interest,
                "onward_transit_pool": transit_pool,
                "railbus_capture_rate_pct": min(100.0, adoption_share),
                "booking_growth_rate": float(r.get("booking_growth_last_hour_synthetic", 0.0))
            })
            total_adopted += expected
            total_p10 += low
            total_p90 += high
            total_confirmed += curr_b

        total_transit_pool = model_03_transit["total_onward_transit_demand"]
        overall_adoption_pct = round((total_adopted / max(1, total_transit_pool)) * 100, 1)

        return {
            "model_id": "Model 04",
            "title": "RailBus Adoption Prediction",
            "question": "How many passengers are likely to choose RailBus?",
            "total_expected_railbus_passengers": total_adopted,
            "overall_adoption_rate_pct": min(100.0, overall_adoption_pct),
            "total_confirmed_bookings": total_confirmed,
            "total_confidence_range": [total_p10, total_p90],
            "route_breakdown": route_results,
            "methodology": "XGBoost Regressor on confirmed bookings, interest velocity, and route demand history"
        }
