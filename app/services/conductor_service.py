import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import TicketStatus, TripStatus
from app.core.exceptions import (
    AlreadyBoardedException,
    DomainException,
    EntityNotFoundException,
    ForbiddenException,
    InvalidTicketException,
)
from app.core.security import parse_and_verify_qr_string
from app.models.booking import Booking
from app.models.bus import Conductor
from app.models.ticket import BoardingRecord, Ticket
from app.models.trip import Trip
from app.schemas.conductor import (
    BoardTicketResponse,
    ConductorTripSummary,
    ManifestResponse,
    OfflineBoardingItem,
    OfflineSyncBatchResponse,
    PassengerManifestItem,
)


class ConductorService:
    @staticmethod
    async def get_assigned_trips(db: AsyncSession, conductor_id: str) -> List[ConductorTripSummary]:
        stmt = (
            select(Trip)
            .where(Trip.conductor_id == conductor_id)
            .options(
                selectinload(Trip.route),
                selectinload(Trip.bus)
            )
            .order_by(Trip.departure_time.asc())
        )
        trips = (await db.execute(stmt)).scalars().all()

        summaries = []
        for t in trips:
            summaries.append(
                ConductorTripSummary(
                    id=t.id,
                    route_name=t.route.name if t.route else "Unknown Route",
                    origin=t.route.origin if t.route else "",
                    destination=t.route.destination if t.route else "",
                    status=t.status,
                    bus_registration=t.bus.registration_number if t.bus else None,
                    capacity=t.capacity,
                    boarded_count=t.boarded_count,
                    total_confirmed_passengers=t.demand_count,
                    departure_time=t.departure_time
                )
            )
        return summaries

    @staticmethod
    async def get_trip_manifest(db: AsyncSession, trip_id: str, conductor_id: Optional[str] = None) -> ManifestResponse:
        # Fetch trip
        stmt_t = (
            select(Trip)
            .where(Trip.id == trip_id)
            .options(
                selectinload(Trip.route),
                selectinload(Trip.bus)
            )
        )
        trip = (await db.execute(stmt_t)).scalar_one_or_none()
        if not trip:
            raise EntityNotFoundException("Trip", trip_id)

        if conductor_id and trip.conductor_id != conductor_id:
            raise ForbiddenException("Conductor is not assigned to this trip")

        # Fetch tickets with bookings and passengers
        stmt_tk = (
            select(Ticket)
            .where(Ticket.trip_id == trip_id)
            .options(
                selectinload(Ticket.booking).selectinload(Booking.passenger),
                selectinload(Ticket.boarding_record)
            )
            .order_by(Ticket.ticket_reference.asc())
        )
        tickets = (await db.execute(stmt_tk)).scalars().all()

        manifest_items: List[PassengerManifestItem] = []
        for tk in tickets:
            p_name = tk.booking.passenger.full_name if tk.booking and tk.booking.passenger else "Unknown"
            p_phone = tk.booking.passenger.phone if tk.booking and tk.booking.passenger else None
            seats = tk.booking.seat_count if tk.booking else 1
            b_at = tk.boarding_record.boarded_at if tk.boarding_record else None

            manifest_items.append(
                PassengerManifestItem(
                    ticket_id=tk.id,
                    ticket_reference=tk.ticket_reference,
                    passenger_name=p_name,
                    passenger_phone=p_phone,
                    seat_count=seats,
                    status=tk.status,
                    boarded_at=b_at
                )
            )

        return ManifestResponse(
            trip_id=trip.id,
            route_name=trip.route.name if trip.route else "Route",
            bus_registration=trip.bus.registration_number if trip.bus else None,
            status=trip.status,
            total_passengers=trip.demand_count,
            boarded_count=trip.boarded_count,
            manifest=manifest_items
        )

    @staticmethod
    async def open_boarding_window(db: AsyncSession, trip_id: str, conductor_id: str) -> Trip:
        stmt = select(Trip).where(Trip.id == trip_id)
        trip = (await db.execute(stmt)).scalar_one_or_none()
        if not trip:
            raise EntityNotFoundException("Trip", trip_id)

        if trip.conductor_id != conductor_id:
            raise ForbiddenException("Not authorized for this trip")

        if trip.status not in [TripStatus.SCHEDULED, TripStatus.BOARDING]:
            raise DomainException(
                status_code=400,
                detail=f"Cannot open boarding for trip in status {trip.status.value}",
                error_code="INVALID_STATUS"
            )

        trip.status = TripStatus.BOARDING
        trip.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(trip)
        return trip

    @staticmethod
    async def confirm_passenger_boarding(
        db: AsyncSession,
        trip_id: str,
        conductor: Conductor,
        qr_code_str: str,
        device_id: Optional[str] = "conductor-app"
    ) -> BoardTicketResponse:
        # Verify trip assignment
        stmt_t = select(Trip).where(Trip.id == trip_id)
        trip = (await db.execute(stmt_t)).scalar_one_or_none()
        if not trip:
            raise EntityNotFoundException("Trip", trip_id)

        if trip.conductor_id != conductor.id:
            raise ForbiddenException("You are not the assigned conductor for this trip")

        ticket_id = None
        if "." in qr_code_str:
            # Parse and verify HMAC QR signature
            valid_sig, data, err_msg = parse_and_verify_qr_string(qr_code_str)
            if not valid_sig or not data:
                raise InvalidTicketException(f"QR validation failed: {err_msg}")

            ticket_id = data.get("ticket_id")
            encoded_trip_id = data.get("trip_id")

            if encoded_trip_id != trip_id:
                raise InvalidTicketException(f"Ticket belongs to a different trip ({encoded_trip_id})")
        else:
            # Direct ticket_id or ticket_reference manual check-in
            stmt_find = (
                select(Ticket)
                .where((Ticket.id == qr_code_str) | (Ticket.ticket_reference == qr_code_str))
                .where(Ticket.trip_id == trip_id)
            )
            ticket_found = (await db.execute(stmt_find)).scalar_one_or_none()
            if not ticket_found:
                raise EntityNotFoundException("Ticket for trip", qr_code_str)
            ticket_id = ticket_found.id

        # Fetch ticket with booking and passenger
        stmt_tk = (
            select(Ticket)
            .where(Ticket.id == ticket_id)
            .options(selectinload(Ticket.booking).selectinload(Booking.passenger))
        )
        ticket = (await db.execute(stmt_tk)).scalar_one_or_none()
        if not ticket:
            raise EntityNotFoundException("Ticket", ticket_id)

        if ticket.status == TicketStatus.BOARDED:
            raise AlreadyBoardedException(f"Ticket {ticket.ticket_reference} was already boarded!")

        if ticket.status != TicketStatus.ISSUED:
            raise InvalidTicketException(f"Ticket cannot be boarded (status: {ticket.status.value})")

        # Mark boarded
        now = datetime.now(timezone.utc)
        ticket.status = TicketStatus.BOARDED

        # Record boarding
        boarding_rec = BoardingRecord(
            id=str(uuid.uuid4()),
            ticket_id=ticket.id,
            trip_id=trip.id,
            conductor_id=conductor.id,
            passenger_id=ticket.passenger_id,
            boarded_at=now,
            scan_device_id=device_id
        )
        db.add(boarding_rec)

        # Increment boarded count
        seats = ticket.booking.seat_count if ticket.booking else 1
        trip.boarded_count += seats
        trip.updated_at = now

        # Auto-advance trip to BOARDING if was SCHEDULED
        if trip.status == TripStatus.SCHEDULED:
            trip.status = TripStatus.BOARDING

        await db.commit()
        await db.refresh(trip)

        passenger_name = ticket.booking.passenger.full_name if ticket.booking and ticket.booking.passenger else "Passenger"

        return BoardTicketResponse(
            success=True,
            ticket_id=ticket.id,
            ticket_reference=ticket.ticket_reference,
            passenger_name=passenger_name,
            boarded_at=now,
            boarded_count=trip.boarded_count,
            total_passengers=trip.demand_count,
            message=f"Passenger {passenger_name} successfully boarded!"
        )

    @staticmethod
    async def process_offline_batch(
        db: AsyncSession,
        trip_id: str,
        conductor: Conductor,
        items: List[OfflineBoardingItem]
    ) -> OfflineSyncBatchResponse:
        stmt_t = select(Trip).where(Trip.id == trip_id)
        trip = (await db.execute(stmt_t)).scalar_one_or_none()
        if not trip:
            raise EntityNotFoundException("Trip", trip_id)

        if trip.conductor_id != conductor.id:
            raise ForbiddenException("Conductor not assigned to this trip")

        synced_count = 0
        failed_count = 0
        errors: List[str] = []

        for item in items:
            stmt_tk = (
                select(Ticket)
                .where(Ticket.id == item.ticket_id)
                .options(selectinload(Ticket.booking))
            )
            ticket = (await db.execute(stmt_tk)).scalar_one_or_none()
            if not ticket:
                failed_count += 1
                errors.append(f"Ticket {item.ticket_id} not found")
                continue

            if ticket.status == TicketStatus.BOARDED:
                # Already boarded (either synced earlier or by online scan)
                continue

            # Apply boarding
            ticket.status = TicketStatus.BOARDED
            boarding_rec = BoardingRecord(
                id=str(uuid.uuid4()),
                ticket_id=ticket.id,
                trip_id=trip.id,
                conductor_id=conductor.id,
                passenger_id=ticket.passenger_id,
                boarded_at=item.boarded_at or datetime.now(timezone.utc),
                scan_device_id=item.device_id or "offline-sync"
            )
            db.add(boarding_rec)
            seats = ticket.booking.seat_count if ticket.booking else 1
            trip.boarded_count += seats
            synced_count += 1

        if synced_count > 0:
            trip.updated_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(trip)

        return OfflineSyncBatchResponse(
            trip_id=trip.id,
            synced_count=synced_count,
            failed_count=failed_count,
            boarded_count=trip.boarded_count,
            total_passengers=trip.demand_count,
            errors=errors
        )

    @staticmethod
    async def complete_trip(
        db: AsyncSession, trip_id: str, conductor_id: str, status: TripStatus
    ) -> Trip:
        stmt = select(Trip).where(Trip.id == trip_id)
        trip = (await db.execute(stmt)).scalar_one_or_none()
        if not trip:
            raise EntityNotFoundException("Trip", trip_id)

        if trip.conductor_id != conductor_id:
            raise ForbiddenException("Conductor not assigned to this trip")

        trip.status = status
        trip.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(trip)
        return trip
