"""
RailBus Intelligence Engine - Production FastAPI Application
Serves the 4-Stage Demand Inference Architecture, Google OR-Tools Transport Optimization,
and the Interactive Operator Dashboard (Predict -> Plan -> Deploy).
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

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
MODELS_DIR = os.path.join(BASE_DIR, "models")

app = FastAPI(
    title="RailBus Intelligence Engine API",
    description="4-Stage Demand Intelligence & OR-Tools Fleet Optimization for Mysuru Junction",
    version="2.0.0"
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


class DeploymentRequest(BaseModel):
    event_id: str
    operator_name: str
    notes: Optional[str] = ""
    overrides: Optional[Dict[str, Any]] = None


class SimulationRequest(BaseModel):
    event_id: str
    delay_minutes_delta: int = 0
    booking_growth_multiplier: float = 1.0
    festival_surge_multiplier: float = 1.0
    risk_tolerance: str = "balanced"


@app.get("/", response_class=FileResponse)
def serve_dashboard():
    """Serves the RailBus Operator Dashboard UI."""
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse({"status": "RailBus Engine Online", "dashboard": "Loading index.html"})


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "station": "Mysuru Junction (MYS)",
        "models_active": {
            "model_01_arrivals": "XGBoost Regressor + Poisson GLM Benchmark",
            "model_02_destination_distribution": "Multi-destination Share Predictor",
            "model_03_transit_demand": "Onward Transportation Propensity Estimator",
            "model_04_railbus_adoption": "XGBoost Booking Propensity Model",
            "transport_optimization": "Google OR-Tools Mixed-Integer Linear Program (MILP)"
        }
    }


@app.get("/api/trains")
def list_trains(limit: int = Query(50, ge=1, le=500)):
    """List incoming train arrival events."""
    trains = engine.get_upcoming_trains(limit=limit)
    return {"count": len(trains), "trains": trains}


@app.get("/api/pipeline/{event_id}")
def get_event_pipeline(
    event_id: str,
    horizon: float = Query(2.0, description="Snapshot hours before arrival: 24.0, 6.0, 2.0, 0.5"),
    risk: str = Query("balanced", description="Risk tolerance: conservative, balanced, lean")
):
    """
    Executes the full Predict -> Plan pipeline:
    - Model 01 (Arrivals)
    - Model 02 (Destination Distribution)
    - Model 03 (Onward Transit Need)
    - Model 04 (RailBus Adoption)
    - Transport Optimization Engine (OR-Tools)
    """
    try:
        result = engine.execute_pipeline(event_id=event_id, snapshot_horizon=horizon, risk_tolerance=risk)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")


@app.post("/api/deploy")
def deploy_manifest(payload: DeploymentRequest):
    """
    Executes the 'Deploy' stage: locks the plan and issues official digital dispatch manifest.
    """
    try:
        manifest = engine.deploy_manifest(
            event_id=payload.event_id,
            operator_name=payload.operator_name,
            notes=payload.notes,
            custom_route_overrides=payload.overrides
        )
        return {"status": "success", "manifest": manifest}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/simulate")
def simulate_scenario(payload: SimulationRequest):
    """
    What-if simulation engine:
    Simulates train delays, passenger booking spikes, or festival crowd surges.
    """
    try:
        sim = engine.simulate_scenario(
            event_id=payload.event_id,
            delay_minutes_delta=payload.delay_minutes_delta,
            booking_growth_multiplier=payload.booking_growth_multiplier,
            festival_surge_multiplier=payload.festival_surge_multiplier,
            risk_tolerance=payload.risk_tolerance
        )
        return sim
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metrics")
def get_model_benchmarks():
    """Returns benchmark evaluations across all 4 models."""
    metas = {}
    for mid in ["model_01", "model_02", "model_03", "model_04"]:
        path = os.path.join(MODELS_DIR, f"{mid}_metadata.json")
        if os.path.exists(path):
            with open(path) as f:
                metas[mid] = json.load(f)

    return {
        "benchmarks": metas,
        "fleet_catalog": {
            "Mini RailBus": {"seats": 18, "cost_inr": 1200, "crew": 2, "turnaround_mins": 30},
            "Standard RailBus": {"seats": 32, "cost_inr": 1800, "crew": 2, "turnaround_mins": 45},
            "Express Coach": {"seats": 48, "cost_inr": 2500, "crew": 2, "turnaround_mins": 60}
        }
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    print(f"Starting RailBus Intelligence Engine on http://localhost:{port}")
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
