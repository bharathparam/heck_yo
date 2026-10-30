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


@router.get("/search", response_model=List[TripResponse])
async def search_trips(
    destination: Optional[str] = Query(None, description="Destination city/stop name"),
    train_number: Optional[str] = Query(None, description="Incoming connecting train number"),
    travel_date: Optional[str] = Query(None, description="Travel date in YYYY-MM-DD format"),
    db: AsyncSession = Depends(get_db)
):
    """Searches trips by destination, train number, and date"""
    from datetime import date
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.trip import Trip
    from app.models.route import Route
    from app.models.train import Train, TrainArrival
    from app.models.bus import Conductor
    from app.config import settings

    stmt = (
        select(Trip)
        .options(
            selectinload(Trip.route),
            selectinload(Trip.bus),
            selectinload(Trip.conductor).selectinload(Conductor.user),
            selectinload(Trip.train_arrival).selectinload(TrainArrival.train)
        )
        .order_by(Trip.departure_time.asc())
    )

    if destination:
        stmt = stmt.join(Trip.route).where(Route.destination.ilike(f"%{destination}%"))

    if travel_date:
        try:
            d = date.fromisoformat(travel_date)
            stmt = stmt.where(Trip.travel_date == d)
        except ValueError:
            pass

    if train_number:
        stmt = stmt.join(Trip.train_arrival).join(TrainArrival.train).where(Train.number == train_number)

    result = await db.execute(stmt)
    trips = result.scalars().all()

    responses = []
    for t in trips:
        responses.append(
            TripResponse(
                id=t.id,
                route_id=t.route_id,
                route_name=t.route.name if t.route else None,
                origin=t.route.origin if t.route else None,
                destination=t.route.destination if t.route else None,
                status=t.status,
                demand_count=t.demand_count,
                capacity=t.capacity,
                min_threshold=t.min_threshold,
                boarded_count=t.boarded_count,
                base_fare=float(t.base_fare),
                travel_date=t.travel_date,
                departure_time=t.departure_time,
                deadline_at=t.deadline_at,
                bus_registration=t.bus.registration_number if t.bus else None,
                conductor_name=t.conductor.user.full_name if (t.conductor and t.conductor.user) else None,
                threshold_met=(t.demand_count >= (t.min_threshold or settings.DEMAND_ACTIVATION_THRESHOLD))
            )
        )
    return responses


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
