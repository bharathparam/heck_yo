"""
RailBus Intelligence Engine - Model Registry
Manages model versions, metadata, data_source provenance, promotion gate decisions,
and serving configurations.
"""
import os
import json
from datetime import datetime
from typing import Dict, Any, Optional

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGISTRY_DIR = os.path.join(BASE_DIR, "models", "registry")
os.makedirs(REGISTRY_DIR, exist_ok=True)
REGISTRY_FILE = os.path.join(REGISTRY_DIR, "registry.json")


class ModelRegistry:
    """Central registry tracking versions, promotion gates, and serving status."""

    CURRENT_VERSION = "v1.1.0"
    DATA_SOURCE = "SYNTHETIC"  # Must be SYNTHETIC or OBSERVED

    @staticmethod
    def load_registry() -> Dict[str, Any]:
        if os.path.exists(REGISTRY_FILE):
            with open(REGISTRY_FILE, "r") as f:
                return json.load(f)
        return {
            "registry_version": "1.0",
            "active_pipeline_version": ModelRegistry.CURRENT_VERSION,
            "data_source": ModelRegistry.DATA_SOURCE,
            "updated_at": datetime.utcnow().isoformat() + "Z",
            "models": {}
        }

    @staticmethod
    def save_registry(data: Dict[str, Any]):
        data["updated_at"] = datetime.utcnow().isoformat() + "Z"
        with open(REGISTRY_FILE, "w") as f:
            json.dump(data, f, indent=2)

    @staticmethod
    def register_model(
        model_id: str,
        name: str,
        version: str,
        promotion_gate_decision: str,  # "PROMOTED_ACTIVE" or "REJECTED_BELOW_BASELINE"
        served_by: str,               # Name of artifact serving predictions
        is_baseline: bool,
        candidate_metrics: Dict[str, Any],
        baseline_metrics: Dict[str, Any],
        gate_notes: str,
        artifacts: Dict[str, str]
    ):
        reg = ModelRegistry.load_registry()
        reg["models"][model_id] = {
            "model_id": model_id,
            "name": name,
            "version": version,
            "data_source": ModelRegistry.DATA_SOURCE,
            "promotion_gate_decision": promotion_gate_decision,
            "served_by": served_by,
            "is_baseline": is_baseline,
            "candidate_metrics": candidate_metrics,
            "baseline_metrics": baseline_metrics,
            "gate_notes": gate_notes,
            "artifacts": artifacts,
            "registered_at": datetime.utcnow().isoformat() + "Z"
        }
        ModelRegistry.save_registry(reg)

    @staticmethod
    def get_serving_info(model_id: str) -> Dict[str, Any]:
        reg = ModelRegistry.load_registry()
        m = reg.get("models", {}).get(model_id)
        if m:
            return {
                "version": m["version"],
                "data_source": m.get("data_source", ModelRegistry.DATA_SOURCE),
                "served_by": m["served_by"],
                "is_baseline": m["is_baseline"],
                "promotion_gate_decision": m["promotion_gate_decision"],
                "gate_notes": m["gate_notes"]
            }
        return {
            "version": ModelRegistry.CURRENT_VERSION,
            "data_source": ModelRegistry.DATA_SOURCE,
            "served_by": "UNKNOWN",
            "is_baseline": True,
            "promotion_gate_decision": "DEFAULT",
            "gate_notes": "Unregistered model fallback"
        }
