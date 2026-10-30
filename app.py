"""
RailBus Intelligence Engine - Honest SmartSync FastAPI Application
Serves the 4-Stage Demand Inference Hierarchy, OR-Tools Supply Optimization,
and Backend Recommendation Transmission.

Core Mandate:
- Recommends to backend but NEVER dispatches.
- All endpoints state data_source, model_version, and served_by.
- No endpoint in this service can modify a trip or booking.
"""
import os
import json
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from engine.intelligence_engine import RailBusIntelligenceEngine
from engine.registry import ModelRegistry
from engine.post_arrival_evaluator import AUDIT_LOG_FILE

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = FastAPI(
    title="RailBus SmartSync Intelligence Module",
    description="Backend-Integrated, Honest Demand Forecasting & Fleet Supply Optimization Module for Mysuru Junction",
    version=ModelRegistry.CURRENT_VERSION
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = RailBusIntelligenceEngine()

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class TransmitRequest(BaseModel):
    event_id: str
    snapshot_horizon: float = 2.0
    risk_tolerance: str = "balanced"


class AuditRequest(BaseModel):
    event_id: str


@app.get("/", response_class=FileResponse)
def serve_dashboard():
    """Serves the RailBus SmartSync Operator Dashboard UI."""
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse({"status": "SmartSync Online", "dashboard": "Loading index.html"})


@app.get("/api/health")
def health_check():
    """Health check reporting data source, active versions, and serving statuses."""
    m1_info = ModelRegistry.get_serving_info("Model_01")
    m4_info = ModelRegistry.get_serving_info("Model_04")
    return {
        "status": "healthy",
        "service": "RailBus SmartSync Intelligence Module",
        "station": "Mysuru Junction (MYS)",
        "data_source": ModelRegistry.DATA_SOURCE,
        "model_version": ModelRegistry.CURRENT_VERSION,
        "mandate": "ADVISORY_ONLY (Recommends to backend, never dispatches directly)",
        "models_active": {
            "model_01_arrivals": {
                "name": "Train Alighting Estimation",
                "served_by": m1_info["served_by"],
                "is_baseline": m1_info["is_baseline"],
                "promotion_gate_status": m1_info["promotion_gate_decision"]
            },
            "model_02_destinations": "Empirical Destination Distribution",
            "model_03_transit_need": "Documented Beta Prior (DOCUMENTED_PRIOR_UNTIL_SURVEY_OBSERVED)",
            "model_04_railbus_adoption": {
                "name": "RailBus Adoption Prediction",
                "served_by": m4_info["served_by"],
                "is_baseline": m4_info["is_baseline"],
                "promotion_gate_status": m4_info["promotion_gate_decision"]
            },
            "transport_optimizer": "Google OR-Tools MILP with Shared Fleet & Conductor Overlap"
        }
    }


@app.get("/api/trains")
def list_trains(limit: int = Query(50, ge=1, le=500)):
    """List incoming train arrival events."""
    trains = engine.get_upcoming_trains(limit=limit)
    return {
        "data_source": ModelRegistry.DATA_SOURCE,
        "count": len(trains),
        "trains": trains
    }


@app.get("/api/pipeline/{event_id}")
def get_event_pipeline(
    event_id: str,
    horizon: float = Query(2.0, description="Snapshot hours before arrival: 24.0, 6.0, 2.0, 0.5"),
    risk: str = Query("balanced", description="Risk tolerance: conservative, balanced, lean")
):
    """
    Executes the 4-stage coherent hierarchy and transport optimization:
    Every model response states data_source, model_version, and served_by.
    """
    try:
        result = engine.execute_pipeline(event_id=event_id, snapshot_horizon=horizon, risk_tolerance=risk)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")


@app.post("/api/recommendations/transmit")
def transmit_recommendations(payload: TransmitRequest):
    """
    Transmits optimization recommendations to the RailBus Backend API:
    POST /api/v1/smartsync/recommendations
    SmartSync recommends fleet allocations; final execution requires operator approval in backend.
    """
    try:
        res = engine.transmit_recommendations_to_backend(
            event_id=payload.event_id,
            snapshot_horizon=payload.snapshot_horizon,
            risk_tolerance=payload.risk_tolerance
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/audit/post-arrival")
def run_post_arrival_audit(payload: AuditRequest):
    """
    Post-arrival evaluation job:
    Compares pre-arrival forecasts against station ground truth actuals.
    """
    try:
        audit = engine.run_post_arrival_audit(event_id=payload.event_id)
        return audit
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/audit/logs")
def get_audit_logs():
    """Returns post-arrival evaluation audit history."""
    if os.path.exists(AUDIT_LOG_FILE):
        try:
            with open(AUDIT_LOG_FILE, "r") as f:
                return {"count": len(json.load(f)), "logs": json.load(f)}
        except Exception:
            return {"count": 0, "logs": []}
    return {"count": 0, "logs": []}


@app.get("/api/registry")
def get_model_registry():
    """Returns model versions, promotion gate decisions, and validation metrics."""
    return ModelRegistry.load_registry()


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    print(f"Starting RailBus SmartSync Intelligence Module on http://localhost:{port}")
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
