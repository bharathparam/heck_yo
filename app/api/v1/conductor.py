from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import TripStatus
from app.database import get_db
from app.dependencies import get_current_conductor
from app.models.bus import Conductor
from app.schemas.conductor import (
    BoardTicketRequest,
    BoardTicketResponse,
    ConductorTripSummary,
    ManifestResponse,
    OfflineSyncBatchRequest,
    OfflineSyncBatchResponse,
)
from app.services.conductor_service import ConductorService

router = APIRouter(prefix="/conductor", tags=["Conductor Operations"])


@router.get("/trips", response_model=List[ConductorTripSummary])
async def get_my_trips(
    conductor: Conductor = Depends(get_current_conductor),
    db: AsyncSession = Depends(get_db)
):
    """Returns all trips assigned to the currently logged in conductor"""
    return await ConductorService.get_assigned_trips(db, conductor.id)


@router.get("/trips/{trip_id}/manifest", response_model=ManifestResponse)
async def get_trip_manifest(
    trip_id: str,
    conductor: Conductor = Depends(get_current_conductor),
    db: AsyncSession = Depends(get_db)
):
    """Returns passenger manifest with real-time boarding statuses"""
    return await ConductorService.get_trip_manifest(db, trip_id, conductor.id)


@router.post("/trips/{trip_id}/boarding/open")
async def open_boarding(
    trip_id: str,
    conductor: Conductor = Depends(get_current_conductor),
    db: AsyncSession = Depends(get_db)
):
    """Opens passenger boarding window for the trip"""
    trip = await ConductorService.open_boarding_window(db, trip_id, conductor.id)
    return {"trip_id": trip.id, "status": trip.status, "message": "Boarding window opened"}


@router.post("/trips/{trip_id}/board", response_model=BoardTicketResponse)
async def board_passenger_ticket(
    trip_id: str,
    data: BoardTicketRequest,
    conductor: Conductor = Depends(get_current_conductor),
    db: AsyncSession = Depends(get_db)
):
    """
    Validates ticket QR HMAC signature and confirms passenger boarding.
    Atomically updates ticket status to BOARDED, records scan log, and increments trip count.
    """
    return await ConductorService.confirm_passenger_boarding(
        db=db,
        trip_id=trip_id,
        conductor=conductor,
        qr_code_str=data.qr_code,
        device_id=data.device_id
    )


@router.post("/trips/{trip_id}/sync-offline", response_model=OfflineSyncBatchResponse)
async def sync_offline_boardings(
    trip_id: str,
    batch: OfflineSyncBatchRequest,
    conductor: Conductor = Depends(get_current_conductor),
    db: AsyncSession = Depends(get_db)
):
    """Batch synchronizes offline scans captured by conductor app during connectivity loss"""
    return await ConductorService.process_offline_batch(
        db=db,
        trip_id=trip_id,
        conductor=conductor,
        items=batch.boardings
    )


@router.post("/trips/{trip_id}/depart")
async def depart_trip(
    trip_id: str,
    conductor: Conductor = Depends(get_current_conductor),
    db: AsyncSession = Depends(get_db)
):
    """Marks trip as DEPARTED"""
    trip = await ConductorService.complete_trip(db, trip_id, conductor.id, TripStatus.DEPARTED)
    return {"trip_id": trip.id, "status": trip.status, "message": "Trip marked as departed"}


@router.post("/trips/{trip_id}/complete")
async def complete_trip(
    trip_id: str,
    conductor: Conductor = Depends(get_current_conductor),
    db: AsyncSession = Depends(get_db)
):
    """Marks trip as COMPLETED upon arrival at destination"""
    trip = await ConductorService.complete_trip(db, trip_id, conductor.id, TripStatus.COMPLETED)
    return {"trip_id": trip.id, "status": trip.status, "message": "Trip marked as completed"}
