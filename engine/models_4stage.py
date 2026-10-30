"""
RailBus Intelligence Engine - Coherent 4-Stage Demand Inference Hierarchy
Strictly enforces the physical structural ordering at prediction time:
    confirmed_bookings <= RailBus Adoption <= Onward Transit Need <= Destination Pax <= Alighting Pax

Includes:
- Data honesty tags (data_source = SYNTHETIC | OBSERVED)
- Registry promotion gate enforcement (serves Poisson GLM baseline if candidate rejected)
- Documented Bayesian Beta priors for Model 03 (labeled DOCUMENTED_PRIOR_UNTIL_SURVEY_OBSERVED)
- Censoring awareness documentation
"""
import os
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional

from engine.registry import ModelRegistry

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")


class RailBus4StagePredictor:
    """Coherent hierarchical predictor strictly preserving physical transit constraints."""

    def __init__(self, models_dir: str = MODELS_DIR):
        self.models_dir = models_dir
        self.m1_pkg = joblib.load(os.path.join(models_dir, "model_01_arrival.joblib"))
        self.m2_pkg = joblib.load(os.path.join(models_dir, "model_02_destination.joblib"))
        self.m3_pkg = joblib.load(os.path.join(models_dir, "model_03_transit_demand.joblib"))
        self.m4_pkg = joblib.load(os.path.join(models_dir, "model_04_adoption.joblib"))

    # -------------------------------------------------------------
    # MODEL 01: Train-wise Passenger Arrival Estimation
    # -------------------------------------------------------------
    def predict_model_01_arrivals(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Model 01: How many passengers will get down at Mysuru from each incoming train?
        Respects Promotion Gate: If candidate failed promotion, serves Poisson GLM baseline.
        """
        serving_info = ModelRegistry.get_serving_info("Model_01")
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

        # Baseline prediction (Poisson GLM)
        poisson_val = float(np.maximum(0, self.m1_pkg["baseline_model"].predict(X_proc)[0]))
        # Candidate prediction (XGBoost)
        xgb_val = float(np.maximum(0, self.m1_pkg["primary_model"].predict(X_proc)[0]))
        
        # Quantiles
        p10_val = float(np.maximum(0, self.m1_pkg["p10_model"].predict(X_proc)[0]))
        p90_val = float(np.maximum(poisson_val, self.m1_pkg["p90_model"].predict(X_proc)[0]))

        # Promotion Gate Decision: Serve baseline if candidate was rejected
        if serving_info.get("is_baseline", True):
            effective_alighting = int(round(poisson_val))
            served_by = "BASELINE_POISSON_GLM"
            is_baseline = True
        else:
            effective_alighting = int(round(xgb_val))
            served_by = "CANDIDATE_XGBOOST"
            is_baseline = False

        low_bound = min(effective_alighting, int(round(p10_val)))
        high_bound = max(effective_alighting, int(round(p90_val)))

        return {
            "model_id": "Model_01",
            "title": "Train-wise Passenger Arrival Estimation",
            "question": "How many passengers will get down at Mysuru from each incoming train?",
            "data_source": self.m1_pkg.get("data_source", "SYNTHETIC"),
            "model_version": serving_info.get("version", "v1.1.0"),
            "served_by": served_by,
            "is_baseline": is_baseline,
            "promotion_gate_status": serving_info.get("promotion_gate_decision", "REJECTED_BELOW_BASELINE"),
            "gate_reason": serving_info.get("gate_notes", "Serving baseline model in production."),
            "target": "alighting_passengers_actual_synthetic",
            "expected_alighting_passengers": effective_alighting,
            "poisson_baseline_estimate": int(round(poisson_val)),
            "candidate_xgboost_estimate": int(round(xgb_val)),
            "lower_bound_p10": low_bound,
            "upper_bound_p90": high_bound,
            "confidence_interval_80pct": [low_bound, high_bound],
            "censoring_bias_note": self.m1_pkg.get("censoring_bias_note")
        }

    # -------------------------------------------------------------
    # MODEL 02: Destination-wise Passenger Distribution
    # -------------------------------------------------------------
    def predict_model_02_destinations(self, event_data: Dict[str, Any], total_alighting: int) -> Dict[str, Any]:
        """
        Model 02: Where will those passengers go after arriving?
        Partition Constraint: Sum of destination passengers EXACTLY equals total_alighting.
        Each destination count D_k <= total_alighting.
        """
        serving_info = ModelRegistry.get_serving_info("Model_02")
        destinations = self.m2_pkg["destinations"]
        origin = event_data.get("origin_station", "Unknown")
        ttype = event_data.get("train_type", "Unknown")

        origin_profile = self.m2_pkg["origin_profiles"].get(origin)
        ttype_profile = self.m2_pkg["train_type_profiles"].get(ttype)
        mean_profile = self.m2_pkg["mean_shares"]

        shares = {}
        for d in destinations:
            s_orig = origin_profile.get(d, mean_profile.get(d, 0.1)) if origin_profile else mean_profile.get(d, 0.1)
            s_type = ttype_profile.get(d, mean_profile.get(d, 0.1)) if ttype_profile else mean_profile.get(d, 0.1)
            shares[d] = 0.5 * s_orig + 0.5 * s_type

        tot_share = sum(shares.values())
        norm_shares = {k: v / tot_share for k, v in shares.items()}

        # Allocate integer passengers ensuring strict sum equality to total_alighting
        pax_counts = {}
        allocated = 0
        sorted_dests = sorted(norm_shares.items(), key=lambda x: x[1], reverse=True)
        for i, (d, sh) in enumerate(sorted_dests):
            if i == len(sorted_dests) - 1:
                pax = max(0, total_alighting - allocated)
            else:
                pax = min(total_alighting - allocated, int(round(total_alighting * sh)))
                allocated += pax
            pax_counts[d] = pax

        return {
            "model_id": "Model_02",
            "title": "Destination-wise Passenger Distribution",
            "question": "Where will those passengers go after arriving?",
            "data_source": self.m2_pkg.get("data_source", "SYNTHETIC"),
            "model_version": serving_info.get("version", "v1.1.0"),
            "served_by": serving_info.get("served_by", "EMPIRICAL_DESTINATION_DISTRIBUTION"),
            "is_baseline": serving_info.get("is_baseline", False),
            "destination_shares_pct": {k: round(v * 100, 1) for k, v in norm_shares.items()},
            "destination_passenger_counts": pax_counts,
            "total_accounted_passengers": sum(pax_counts.values()),
            "coherence_constraint_verified": sum(pax_counts.values()) == total_alighting
        }

    # -------------------------------------------------------------
    # MODEL 03: Onward Transportation Demand (Documented Prior Model)
    # -------------------------------------------------------------
    def predict_model_03_transit_demand(
        self,
        event_data: Dict[str, Any],
        destination_passengers: Dict[str, int]
    ) -> Dict[str, Any]:
        """
        Model 03: How many passengers will need onward transportation, irrespective of whether they use RailBus?
        Uses documented Bayesian Beta priors:
            N_k <= D_k  and  sum(N_k) <= total_alighting.
        Clearly labeled as PRIOR_UNTIL_SURVEY_OBSERVED.
        """
        serving_info = ModelRegistry.get_serving_info("Model_03")
        priors = self.m3_pkg["documented_priors"]
        weather = event_data.get("weather_synthetic", "Clear")
        arr_hour = int(event_data.get("arrival_hour", 12))

        w_mult = self.m3_pkg.get("weather_multipliers", {}).get(weather, 1.0)
        night_boost = self.m3_pkg.get("night_boost", 0.08) if (arr_hour >= 20 or arr_hour <= 6) else 0.0

        dest_transit_need = {}
        total_need = 0
        total_pax = 0

        for dest, count in destination_passengers.items():
            prior_spec = priors.get(dest, {"prior_mean": 0.50, "ci_80": [0.40, 0.60], "rationale": "Default baseline prior"})
            base_rate = prior_spec["prior_mean"]
            
            # Adjusted prior with operational context
            eff_rate = min(0.98, max(0.15, (base_rate + night_boost) * w_mult))
            needed_pax = min(count, max(0, int(round(count * eff_rate))))
            
            # Uncertainty bounds on transit need
            p10_rate = min(eff_rate, prior_spec["ci_80"][0])
            p90_rate = max(eff_rate, prior_spec["ci_80"][1])
            need_p10 = min(count, max(0, int(round(count * p10_rate))))
            need_p90 = min(count, max(needed_pax, int(round(count * p90_rate))))

            dest_transit_need[dest] = {
                "destination_passengers": count,
                "prior_mean_rate_pct": round(prior_spec["prior_mean"] * 100, 1),
                "adjusted_transit_need_rate_pct": round(eff_rate * 100, 1),
                "onward_transit_passengers": needed_pax,
                "transit_need_range_80pct": [need_p10, need_p90],
                "private_or_local_passengers": max(0, count - needed_pax),
                "prior_rationale": prior_spec.get("rationale", "")
            }
            total_need += needed_pax
            total_pax += count

        overall_need_pct = round((total_need / max(1, total_pax)) * 100, 1)

        return {
            "model_id": "Model_03",
            "title": "Onward Transportation Demand",
            "question": "How many passengers will need onward transportation, irrespective of whether they use RailBus?",
            "data_source": self.m3_pkg.get("data_source", "SYNTHETIC"),
            "model_version": serving_info.get("version", "v1.1.0"),
            "prior_status": self.m3_pkg.get("prior_status", "DOCUMENTED_PRIOR_UNTIL_SURVEY_OBSERVED"),
            "served_by": serving_info.get("served_by", "BAYESIAN_BETA_PRIOR"),
            "is_baseline": True,
            "total_onward_transit_demand": total_need,
            "overall_transit_need_rate_pct": overall_need_pct,
            "total_private_or_local_passengers": max(0, total_pax - total_need),
            "destination_breakdown": dest_transit_need,
            "coherence_constraint_verified": total_need <= total_pax,
            "censoring_bias_note": self.m3_pkg.get("censoring_bias_note")
        }

    # -------------------------------------------------------------
    # MODEL 04: RailBus Adoption Prediction
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
        Enforces Strict Hierarchical Coherence Constraint:
            confirmed_bookings <= RailBus Adoption <= Onward Transit Need <= Destination Pax
        """
        serving_info = ModelRegistry.get_serving_info("Model_04")
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

        raw_p50 = np.maximum(0, self.m4_pkg["primary_model"].predict(X_proc))
        raw_p10 = np.maximum(0, self.m4_pkg["p10_model"].predict(X_proc))
        raw_p90 = np.maximum(raw_p50, self.m4_pkg["p90_model"].predict(X_proc))

        route_results = []
        total_adopted = 0
        total_p10 = 0
        total_p90 = 0
        total_confirmed = 0

        dest_breakdown = model_03_transit["destination_breakdown"]

        for i, r in enumerate(route_snapshots):
            dest = r.get("destination_station", "Unknown")
            curr_b = int(r.get("current_confirmed_bookings", 0))
            interest = int(r.get("passengers_submitted_interest", 0))

            # Upper ceiling enforced from Model 03 onward transit pool
            transit_pool = dest_breakdown.get(dest, {}).get("onward_transit_passengers", curr_b)
            
            # Mathematical hierarchical bound:
            # confirmed_bookings <= expected_adoption <= transit_pool
            val_p50 = int(round(float(raw_p50[i])))
            expected = min(transit_pool, max(curr_b, val_p50))

            val_p10 = int(round(float(raw_p10[i])))
            low = min(expected, max(curr_b, val_p10))

            val_p90 = int(round(float(raw_p90[i])))
            high = min(transit_pool, max(expected, val_p90))

            capture_rate = round((expected / max(1, transit_pool)) * 100, 1)

            route_results.append({
                "destination_station": dest,
                "snapshot_hours_before_arrival": snapshot_horizon,
                "current_confirmed_bookings": curr_b,
                "passengers_submitted_interest": interest,
                "onward_transit_pool": transit_pool,
                "expected_railbus_passengers": expected,
                "lower_bound_p10": low,
                "upper_bound_p90": high,
                "confidence_range": [low, high],
                "railbus_capture_rate_pct": capture_rate,
                "booking_growth_rate": float(r.get("booking_growth_last_hour_synthetic", 0.0)),
                "coherence_satisfied": curr_b <= expected <= transit_pool
            })

            total_adopted += expected
            total_p10 += low
            total_p90 += high
            total_confirmed += curr_b

        total_transit_pool = model_03_transit["total_onward_transit_demand"]
        overall_capture_pct = round((total_adopted / max(1, total_transit_pool)) * 100, 1)

        return {
            "model_id": "Model_04",
            "title": "RailBus Adoption Prediction",
            "question": "How many passengers are likely to choose RailBus?",
            "data_source": self.m4_pkg.get("data_source", "SYNTHETIC"),
            "model_version": serving_info.get("version", "v1.1.0"),
            "served_by": serving_info.get("served_by", "CANDIDATE_XGBOOST"),
            "is_baseline": serving_info.get("is_baseline", False),
            "promotion_gate_status": serving_info.get("promotion_gate_decision", "PROMOTED_ACTIVE"),
            "total_expected_railbus_passengers": total_adopted,
            "overall_adoption_rate_pct": overall_capture_pct,
            "total_confirmed_bookings": total_confirmed,
            "total_confidence_range": [total_p10, total_p90],
            "route_breakdown": route_results,
            "hierarchical_coherence_verified": total_confirmed <= total_adopted <= total_transit_pool,
            "censoring_bias_note": self.m4_pkg.get("censoring_bias_note")
        }
