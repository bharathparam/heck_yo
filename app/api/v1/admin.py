from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import BusStatus, TripStatus, UserRole
from app.core.exceptions import EntityNotFoundException, DomainException
from app.database import get_db
from app.dependencies import require_role
from app.models.audit import AuditLog
from app.models.booking import Booking
from app.models.bus import Bus, Conductor
from app.models.notification import Notification
from app.models.route import Route
from app.models.train import Train, TrainArrival
from app.models.trip import Trip
from app.models.user import User
from app.schemas.admin import (
    AdminAssignmentItem,
    AdminOverviewResponse,
    AuditLogResponse,
    ConductorAdminResponse,
    NotificationResponse,
)
from app.schemas.train import (
    TrainArrivalCreate,
    TrainArrivalResponse,
    TrainCreate,
    TrainResponse,
)

router = APIRouter(prefix="/admin", tags=["Admin Operations"])


# 1. GET /admin/conductors
@router.get("/conductors", response_model=List[ConductorAdminResponse])
async def list_admin_conductors(
    current_user: User = Depends(require_role(UserRole.OPERATOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Lists all conductor profiles with user account details"""
    stmt = (
        select(Conductor)
        .options(selectinload(Conductor.user))
        .order_by(Conductor.employee_id.asc())
    )
    result = await db.execute(stmt)
    conductors = result.scalars().all()

    responses = []
    for c in conductors:
        responses.append(
            ConductorAdminResponse(
                id=c.id,
                user_id=c.user_id,
                employee_id=c.employee_id,
                license_number=c.license_number,
                is_available=c.is_available,
                full_name=c.user.full_name if c.user else "Unknown",
                email=c.user.email if c.user else "",
                phone=c.user.phone if c.user else None,
            )
        )
    return responses


# 2. GET /admin/overview
@router.get("/overview", response_model=AdminOverviewResponse)
async def get_admin_overview(
    current_user: User = Depends(require_role(UserRole.OPERATOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Dashboard metrics: trips breakdown, buses, conductors, bookings"""
    total_trips = (await db.execute(select(func.count(Trip.id)))).scalar() or 0
    active_buses = (await db.execute(select(func.count(Bus.id)).where(Bus.status == BusStatus.ACTIVE, Bus.is_active.is_(True)))).scalar() or 0
    available_conductors = (await db.execute(select(func.count(Conductor.id)).where(Conductor.is_available.is_(True)))).scalar() or 0
    total_confirmed = (await db.execute(select(func.count(Booking.id)).where(Booking.status == "CONFIRMED"))).scalar() or 0

    aggregating = (await db.execute(select(func.count(Trip.id)).where(Trip.status == TripStatus.AGGREGATING))).scalar() or 0
    threshold_met = (await db.execute(select(func.count(Trip.id)).where(Trip.status == TripStatus.THRESHOLD_MET))).scalar() or 0
    scheduled = (await db.execute(select(func.count(Trip.id)).where(Trip.status == TripStatus.SCHEDULED))).scalar() or 0
    boarding = (await db.execute(select(func.count(Trip.id)).where(Trip.status == TripStatus.BOARDING))).scalar() or 0
    completed = (await db.execute(select(func.count(Trip.id)).where(Trip.status == TripStatus.COMPLETED))).scalar() or 0
    cancelled = (await db.execute(select(func.count(Trip.id)).where(Trip.status == TripStatus.CANCELLED))).scalar() or 0

    return AdminOverviewResponse(
        total_trips=total_trips,
        active_buses=active_buses,
        available_conductors=available_conductors,
        total_confirmed_bookings=total_confirmed,
        aggregating_trips=aggregating,
        threshold_met_trips=threshold_met,
        scheduled_trips=scheduled,
        boarding_trips=boarding,
        completed_trips=completed,
        cancelled_trips=cancelled,
    )


# 3. GET /admin/assignments
@router.get("/assignments", response_model=List[AdminAssignmentItem])
async def list_admin_assignments(
    current_user: User = Depends(require_role(UserRole.OPERATOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Lists trips awaiting or assigned with bus & conductor details"""
    stmt = (
        select(Trip)
        .options(
            selectinload(Trip.route),
            selectinload(Trip.bus),
            selectinload(Trip.conductor).selectinload(Conductor.user)
        )
        .order_by(Trip.travel_date.desc(), Trip.departure_time.asc())
    )
    trips = (await db.execute(stmt)).scalars().all()

    items = []
    for t in trips:
        items.append(
            AdminAssignmentItem(
                trip_id=t.id,
                route_name=t.route.name if t.route else "Route",
                travel_date=t.travel_date.isoformat() if t.travel_date else "",
                departure_time=t.departure_time,
                demand_count=t.demand_count,
                min_threshold=t.min_threshold,
                status=t.status,
                bus_registration=t.bus.registration_number if t.bus else None,
                conductor_name=t.conductor.user.full_name if (t.conductor and t.conductor.user) else None,
            )
        )
    return items


# 4. GET /admin/audit-logs
@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def list_audit_logs(
    trip_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_role(UserRole.OPERATOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Lists system audit logs of state transitions and dispatcher assignments"""
    stmt = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)
    if trip_id:
        stmt = stmt.where(AuditLog.trip_id == trip_id)
    result = await db.execute(stmt)
    return result.scalars().all()


# 5. Train CRUD for Operators
@router.get("/trains", response_model=List[TrainResponse])
async def list_trains(
    current_user: User = Depends(require_role(UserRole.OPERATOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Train).order_by(Train.number.asc())
    return (await db.execute(stmt)).scalars().all()


@router.post("/trains", response_model=TrainResponse, status_code=status.HTTP_201_CREATED)
async def create_train(
    data: TrainCreate,
    current_user: User = Depends(require_role(UserRole.OPERATOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    import uuid
    train = Train(
        id=str(uuid.uuid4()),
        name=data.name,
        number=data.number,
        origin=data.origin,
        destination=data.destination,
        is_active=data.is_active
    )
    db.add(train)
    await db.commit()
    await db.refresh(train)
    return train


@router.get("/train-arrivals", response_model=List[TrainArrivalResponse])
async def list_train_arrivals(
    current_user: User = Depends(require_role(UserRole.OPERATOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(TrainArrival)
        .options(selectinload(TrainArrival.train), selectinload(TrainArrival.route))
        .order_by(TrainArrival.arrival_date.desc(), TrainArrival.scheduled_arrival.asc())
    )
    arrivals = (await db.execute(stmt)).scalars().all()
    responses = []
    for a in arrivals:
        responses.append(
            TrainArrivalResponse(
                id=a.id,
                train_id=a.train_id,
                route_id=a.route_id,
                scheduled_arrival=a.scheduled_arrival,
                scheduled_departure=a.scheduled_departure,
                status=a.status,
                arrival_date=a.arrival_date,
                train_name=a.train.name if a.train else None,
                train_number=a.train.number if a.train else None,
                route_name=a.route.name if a.route else None,
            )
        )
    return responses


@router.post("/train-arrivals", response_model=TrainArrivalResponse, status_code=status.HTTP_201_CREATED)
async def create_train_arrival(
    data: TrainArrivalCreate,
    current_user: User = Depends(require_role(UserRole.OPERATOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    import uuid
    arrival = TrainArrival(
        id=str(uuid.uuid4()),
        train_id=data.train_id,
        route_id=data.route_id,
        scheduled_arrival=data.scheduled_arrival,
        scheduled_departure=data.scheduled_departure,
        status=data.status,
        arrival_date=data.arrival_date
    )
    db.add(arrival)
    await db.commit()

    stmt = select(TrainArrival).where(TrainArrival.id == arrival.id).options(
        selectinload(TrainArrival.train), selectinload(TrainArrival.route)
    )
    loaded = (await db.execute(stmt)).scalar_one()
    return TrainArrivalResponse(
        id=loaded.id,
        train_id=loaded.train_id,
        route_id=loaded.route_id,
        scheduled_arrival=loaded.scheduled_arrival,
        scheduled_departure=loaded.scheduled_departure,
        status=loaded.status,
        arrival_date=loaded.arrival_date,
        train_name=loaded.train.name if loaded.train else None,
        train_number=loaded.train.number if loaded.train else None,
        route_name=loaded.route.name if loaded.route else None,
    )
