import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.core.constants import BusStatus, TripStatus
from app.core.exceptions import (
    DomainException,
    EntityNotFoundException,
    InvalidStateTransitionException,
)
from app.models.bus import Bus, Conductor
from app.models.route import Route
from app.models.trip import Trip
from app.schemas.trip import TripAssignRequest, TripCreate, TripResponse


class TripService:
    @staticmethod
    async def create_trip(db: AsyncSession, data: TripCreate) -> Trip:
        # Check route exists
        route = (await db.execute(select(Route).where(Route.id == data.route_id))).scalar_one_or_none()
        if not route:
            raise EntityNotFoundException("Route", data.route_id)

        t_date = data.travel_date
        if not t_date:
            t_date = data.departure_time.date() if data.departure_time else datetime.now(timezone.utc).date()

        deadline = data.deadline_at
        if not deadline and data.departure_time:
            from datetime import timedelta
            deadline = data.departure_time - timedelta(minutes=45)

        new_trip = Trip(
            id=str(uuid.uuid4()),
            route_id=data.route_id,
            train_arrival_id=data.train_arrival_id,
            departure_time=data.departure_time,
            deadline_at=deadline,
            travel_date=t_date,
            min_threshold=data.min_threshold or settings.DEMAND_ACTIVATION_THRESHOLD,
            base_fare=data.base_fare,
            status=TripStatus.AGGREGATING,
            demand_count=0,
            boarded_count=0,
            capacity=40
        )
        db.add(new_trip)
        await db.commit()
        await db.refresh(new_trip)
        return new_trip

    @staticmethod
    async def get_trip_by_id(db: AsyncSession, trip_id: str) -> Optional[Trip]:
        stmt = (
            select(Trip)
            .where(Trip.id == trip_id)
            .options(
                selectinload(Trip.route),
                selectinload(Trip.bus),
                selectinload(Trip.conductor).selectinload(Conductor.user)
            )
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def list_trips(
        db: AsyncSession, status: Optional[TripStatus] = None, route_id: Optional[str] = None
    ) -> List[TripResponse]:
        stmt = (
            select(Trip)
            .options(
                selectinload(Trip.route),
                selectinload(Trip.bus),
                selectinload(Trip.conductor).selectinload(Conductor.user)
            )
            .order_by(Trip.created_at.desc())
        )
        if status:
            stmt = stmt.where(Trip.status == status)
        if route_id:
            stmt = stmt.where(Trip.route_id == route_id)

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
                    conductor_name=t.conductor.user.full_name if t.conductor and t.conductor.user else None,
                    threshold_met=(t.demand_count >= (t.min_threshold or settings.DEMAND_ACTIVATION_THRESHOLD))
                )
            )
        return responses

    @staticmethod
    async def operator_assign_trip(
        db: AsyncSession, trip_id: str, operator_id: str, assign_data: TripAssignRequest
    ) -> Trip:
        trip = await TripService.get_trip_by_id(db, trip_id)
        if not trip:
            raise EntityNotFoundException("Trip", trip_id)

        # Assignment requirement: Trip must have met threshold (or be THRESHOLD_MET)
        threshold = trip.min_threshold or settings.DEMAND_ACTIVATION_THRESHOLD
        if trip.demand_count < threshold:
            raise DomainException(
                status_code=400,
                detail=f"Trip demand ({trip.demand_count}) has not reached minimum activation threshold ({threshold})",
                error_code="THRESHOLD_NOT_MET"
            )

        # Bus validation: must exist, be ACTIVE
        bus = (await db.execute(select(Bus).where(Bus.id == assign_data.bus_id))).scalar_one_or_none()
        if not bus or not bus.is_active or bus.status != BusStatus.ACTIVE:
            raise EntityNotFoundException("Bus", assign_data.bus_id)

        # Bus capacity must be >= trip demand
        if bus.capacity < trip.demand_count:
            raise DomainException(
                status_code=400,
                detail=f"Bus capacity ({bus.capacity}) is less than confirmed trip demand ({trip.demand_count})",
                error_code="CAPACITY_INSUFFICIENT"
            )

        # Check overlapping bus assignments
        if trip.departure_time:
            from datetime import timedelta
            window_start = trip.departure_time - timedelta(hours=2)
            window_end = trip.departure_time + timedelta(hours=2)
            bus_overlap = await db.execute(
                select(Trip)
                .where(Trip.id != trip.id)
                .where(Trip.bus_id == bus.id)
                .where(Trip.status.in_([TripStatus.SCHEDULED, TripStatus.BOARDING, TripStatus.DEPARTED]))
                .where(Trip.departure_time >= window_start, Trip.departure_time <= window_end)
            )
            if bus_overlap.scalar_one_or_none():
                raise DomainException(
                    status_code=409,
                    detail="Bus is already assigned to another active trip in this time window",
                    error_code="BUS_OVERLAP_CONFLICT"
                )

        # Conductor validation: must exist, be available
        conductor = (await db.execute(select(Conductor).where(Conductor.id == assign_data.conductor_id))).scalar_one_or_none()
        if not conductor or not conductor.is_available:
            raise EntityNotFoundException("Conductor", assign_data.conductor_id)

        # Check overlapping conductor assignments
        if trip.departure_time:
            from datetime import timedelta
            c_window_start = trip.departure_time - timedelta(hours=2)
            c_window_end = trip.departure_time + timedelta(hours=2)
            cond_overlap = await db.execute(
                select(Trip)
                .where(Trip.id != trip.id)
                .where(Trip.conductor_id == conductor.id)
                .where(Trip.status.in_([TripStatus.SCHEDULED, TripStatus.BOARDING, TripStatus.DEPARTED]))
                .where(Trip.departure_time >= c_window_start, Trip.departure_time <= c_window_end)
            )
            if cond_overlap.scalar_one_or_none():
                raise DomainException(
                    status_code=409,
                    detail="Conductor is already assigned to another active trip in this time window",
                    error_code="CONDUCTOR_OVERLAP_CONFLICT"
                )

        # Apply assignment values
        trip.bus_id = bus.id
        trip.conductor_id = conductor.id
        trip.approved_by = operator_id
        trip.capacity = bus.capacity
        await db.commit()

        # Run through centralized state machine to transition to SCHEDULED (which automatically issues tickets)
        from app.services.state_machine import transition_trip_state
        return await transition_trip_state(
            db, trip_id=trip.id, target_status=TripStatus.SCHEDULED, performed_by=operator_id, reason="Operator assigned bus and conductor"
        )

    @staticmethod
    async def update_trip_status(db: AsyncSession, trip_id: str, new_status: TripStatus, performed_by: Optional[str] = None, reason: Optional[str] = None) -> Trip:
        from app.services.state_machine import transition_trip_state
        return await transition_trip_state(db, trip_id=trip_id, target_status=new_status, performed_by=performed_by, reason=reason)

