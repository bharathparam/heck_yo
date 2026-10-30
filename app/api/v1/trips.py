from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import TripStatus, UserRole
from app.core.exceptions import EntityNotFoundException
from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User
from app.schemas.trip import TripAssignRequest, TripCreate, TripResponse
from app.services.trip_service import TripService

router = APIRouter(prefix="/trips", tags=["Trips"])


@router.get("", response_model=List[TripResponse])
async def list_trips(
    status: Optional[TripStatus] = Query(None),
    route_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Lists trips with optional filters for status or route"""
    return await TripService.list_trips(db, status=status, route_id=route_id)


@router.post("", response_model=TripResponse)
async def create_trip(
    data: TripCreate,
    current_user: User = Depends(require_role(UserRole.OPERATOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Creates a new trip in AGGREGATING state (Operator/Admin)"""
    trip = await TripService.create_trip(db, data)
    return (await TripService.list_trips(db, route_id=trip.route_id))[0]


@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip(trip_id: str, db: AsyncSession = Depends(get_db)):
    """Returns single trip details"""
    trip = await TripService.get_trip_by_id(db, trip_id)
    if not trip:
        raise EntityNotFoundException("Trip", trip_id)
    trips = await TripService.list_trips(db)
    for t in trips:
        if t.id == trip_id:
            return t
    raise EntityNotFoundException("Trip", trip_id)


@router.post("/{trip_id}/assign", response_model=TripResponse)
async def operator_assign_trip(
    trip_id: str,
    data: TripAssignRequest,
    current_user: User = Depends(require_role(UserRole.OPERATOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Assigns bus and conductor to an eligible trip that met threshold (Operator/Admin)"""
    await TripService.operator_assign_trip(db, trip_id, current_user.id, data)
    trips = await TripService.list_trips(db)
    for t in trips:
        if t.id == trip_id:
            return t
    raise EntityNotFoundException("Trip", trip_id)
