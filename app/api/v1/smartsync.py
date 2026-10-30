import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.database import get_db
from app.dependencies import require_role
from app.models.user import User
from app.schemas.trip import TripAssignRequest, TripResponse
from app.services.trip_service import TripService

router = APIRouter(prefix="/smartsync", tags=["SmartSync Recommendations"])

# In-memory recommendation store (persists across requests during server lifetime)
RECOMMENDATIONS_STORE: Dict[str, Dict[str, Any]] = {}


class SmartSyncRecommendationPayload(BaseModel):
    source_service: str = "SmartSync ML Service"
    data_source: str = "SYNTHETIC"
    model_version: str = "v1.1.0"
    generated_at: str
    confirmed_assignment_recommendations: List[Dict[str, Any]]
    forecast_prepositioning_proposals: List[Dict[str, Any]]
    summary: Dict[str, Any]


@router.post("/recommendations", status_code=status.HTTP_201_CREATED)
async def ingest_recommendations(
    payload: SmartSyncRecommendationPayload,
    current_user: User = Depends(require_role(UserRole.OPERATOR, UserRole.ADMIN))
):
    """
    Authenticated endpoint receiving optimization recommendations from SmartSync.
    SmartSync recommends fleet allocations, but never directly modifies trips.
    """
    rec_id = str(uuid.uuid4())
    record = {
        "id": rec_id,
        "status": "PENDING_OPERATOR_APPROVAL",
        "received_at": datetime.now(timezone.utc).isoformat(),
        "submitted_by": current_user.email,
        "payload": payload.model_dump()
    }
    RECOMMENDATIONS_STORE[rec_id] = record
    return {
        "status": "success",
        "recommendation_id": rec_id,
        "message": "SmartSync recommendations received. Awaiting operator approval.",
        "confirmed_assignments_count": len(payload.confirmed_assignment_recommendations),
        "proposals_count": len(payload.forecast_prepositioning_proposals)
    }


@router.get("/recommendations")
async def list_recommendations(
    current_user: User = Depends(require_role(UserRole.OPERATOR, UserRole.ADMIN))
):
    """Returns all received SmartSync recommendations"""
    return list(RECOMMENDATIONS_STORE.values())


@router.post("/recommendations/{rec_id}/approve/{item_index}", response_model=TripResponse)
async def approve_recommendation(
    rec_id: str,
    item_index: int,
    current_user: User = Depends(require_role(UserRole.OPERATOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Operator approval endpoint:
    Calls the normal TripService.operator_assign_trip function to execute the approved assignment.
    """
    if rec_id not in RECOMMENDATIONS_STORE:
        raise HTTPException(status_code=404, detail="Recommendation batch not found")

    rec = RECOMMENDATIONS_STORE[rec_id]
    items = rec["payload"].get("confirmed_assignment_recommendations", [])
    if item_index < 0 or item_index >= len(items):
        raise HTTPException(status_code=400, detail="Invalid recommendation item index")

    item = items[item_index]
    trip_id = item.get("trip_id")
    bus_id = item.get("bus_id")
    conductor_id = item.get("conductor_id")

    if not trip_id or not bus_id or not conductor_id:
        raise HTTPException(status_code=400, detail="Incomplete recommendation details")

    # Call normal backend assignment function!
    assign_req = TripAssignRequest(bus_id=bus_id, conductor_id=conductor_id)
    await TripService.operator_assign_trip(db, trip_id, current_user.id, assign_req)

    # Mark as approved
    item["approved_at"] = datetime.now(timezone.utc).isoformat()
    item["approved_by"] = current_user.email

    trips = await TripService.list_trips(db)
    for t in trips:
        if t.id == trip_id:
            return t
    raise HTTPException(status_code=500, detail="Trip assigned but failed to reload")
