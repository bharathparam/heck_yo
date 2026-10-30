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

        new_trip = Trip(
            id=str(uuid.uuid4()),
            route_id=data.route_id,
            train_arrival_id=data.train_arrival_id,
            departure_time=data.departure_time,
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
                    boarded_count=t.boarded_count,
                    base_fare=float(t.base_fare),
                    departure_time=t.departure_time,
                    bus_registration=t.bus.registration_number if t.bus else None,
                    conductor_name=t.conductor.user.full_name if t.conductor and t.conductor.user else None,
                    threshold_met=(t.demand_count >= settings.DEMAND_ACTIVATION_THRESHOLD)
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

        # Trip must be THRESHOLD_MET or AGGREGATING (operator override allowed if threshold met)
        if trip.demand_count < settings.DEMAND_ACTIVATION_THRESHOLD and trip.status == TripStatus.AGGREGATING:
            raise DomainException(
                status_code=400,
                detail=f"Trip demand ({trip.demand_count}) has not reached minimum activation threshold ({settings.DEMAND_ACTIVATION_THRESHOLD})",
                error_code="THRESHOLD_NOT_MET"
            )

        bus = (await db.execute(select(Bus).where(Bus.id == assign_data.bus_id))).scalar_one_or_none()
        if not bus or not bus.is_active:
            raise EntityNotFoundException("Bus", assign_data.bus_id)

        conductor = (await db.execute(select(Conductor).where(Conductor.id == assign_data.conductor_id))).scalar_one_or_none()
        if not conductor:
            raise EntityNotFoundException("Conductor", assign_data.conductor_id)

        trip.bus_id = bus.id
        trip.conductor_id = conductor.id
        trip.approved_by = operator_id
        trip.capacity = bus.capacity
        trip.status = TripStatus.SCHEDULED
        trip.updated_at = datetime.now(timezone.utc)

        await db.commit()
        await db.refresh(trip)
        return trip

    @staticmethod
    async def update_trip_status(db: AsyncSession, trip_id: str, new_status: TripStatus) -> Trip:
        trip = await TripService.get_trip_by_id(db, trip_id)
        if not trip:
            raise EntityNotFoundException("Trip", trip_id)

        # State transition validation
        valid_transitions = {
            TripStatus.AGGREGATING: [TripStatus.THRESHOLD_MET, TripStatus.CANCELLED],
            TripStatus.THRESHOLD_MET: [TripStatus.SCHEDULED, TripStatus.CANCELLED],
            TripStatus.SCHEDULED: [TripStatus.BOARDING, TripStatus.CANCELLED],
            TripStatus.BOARDING: [TripStatus.DEPARTED, TripStatus.CANCELLED],
            TripStatus.DEPARTED: [TripStatus.COMPLETED],
            TripStatus.COMPLETED: [],
            TripStatus.CANCELLED: []
        }

        allowed = valid_transitions.get(trip.status, [])
        if new_status not in allowed:
            raise InvalidStateTransitionException(trip.status.value, new_status.value)

        trip.status = new_status
        trip.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(trip)
        return trip
