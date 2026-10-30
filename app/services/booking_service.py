import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.core.constants import BookingStatus, PaymentStatus, TripStatus
from app.core.exceptions import (
    DomainException,
    EntityNotFoundException,
    TripCapacityExceededException,
)
from app.models.booking import Booking, Payment
from app.models.trip import Trip
from app.schemas.booking import BookingCreate, PaymentSimulationRequest
from app.services.ticket_service import TicketService


class BookingService:
    @staticmethod
    async def get_max_active_bus_capacity(db: AsyncSession) -> int:
        from app.models.bus import Bus
        from app.core.constants import BusStatus
        from sqlalchemy import func
        stmt = select(func.max(Bus.capacity)).where(Bus.status == BusStatus.ACTIVE, Bus.is_active.is_(True))
        max_cap = (await db.execute(stmt)).scalar()
        return max_cap or 40

    @staticmethod
    async def create_booking(db: AsyncSession, passenger_id: str, data: BookingCreate) -> Booking:
        # Fetch trip
        stmt = select(Trip).where(Trip.id == data.trip_id)
        trip = (await db.execute(stmt)).scalar_one_or_none()
        if not trip:
            raise EntityNotFoundException("Trip", data.trip_id)

        if trip.status in [TripStatus.DEPARTED, TripStatus.COMPLETED, TripStatus.CANCELLED]:
            raise DomainException(status_code=400, detail="Cannot book seats for this trip (already departed or closed)")

        # Determine effective capacity: assigned bus capacity, or max active bus capacity before assignment
        effective_capacity = trip.capacity
        if trip.status in [TripStatus.AGGREGATING, TripStatus.THRESHOLD_MET] and not trip.bus_id:
            effective_capacity = await BookingService.get_max_active_bus_capacity(db)
            trip.capacity = effective_capacity

        if trip.demand_count + data.seat_count > effective_capacity:
            raise TripCapacityExceededException("Not enough seats available on this trip")

        booking_id = str(uuid.uuid4())
        ref = f"BK-{uuid.uuid4().hex[:8].upper()}"
        total_fare = float(trip.base_fare) * data.seat_count

        booking = Booking(
            id=booking_id,
            trip_id=data.trip_id,
            passenger_id=passenger_id,
            booking_reference=ref,
            status=BookingStatus.PENDING_PAYMENT,
            fare_amount=total_fare,
            seat_count=data.seat_count
        )
        db.add(booking)
        await db.commit()
        await db.refresh(booking)
        return booking

    @staticmethod
    async def confirm_payment_and_issue_ticket(
        db: AsyncSession, passenger_id: str, payment_req: PaymentSimulationRequest
    ) -> Payment:
        # 1. Check idempotency and verify it belongs to the caller
        stmt_idem = (
            select(Payment)
            .where(Payment.idempotency_key == payment_req.idempotency_key)
            .options(selectinload(Payment.booking))
        )
        existing_payment = (await db.execute(stmt_idem)).scalar_one_or_none()
        if existing_payment:
            if existing_payment.booking.passenger_id != passenger_id:
                raise ForbiddenException("Idempotency key does not belong to caller")
            return existing_payment

        # 2. Fetch booking
        stmt_b = (
            select(Booking)
            .where(Booking.id == payment_req.booking_id)
            .options(selectinload(Booking.trip))
        )
        booking = (await db.execute(stmt_b)).scalar_one_or_none()
        if not booking:
            raise EntityNotFoundException("Booking", payment_req.booking_id)

        if booking.passenger_id != passenger_id:
            raise DomainException(status_code=403, detail="Booking belongs to another user")

        if booking.status == BookingStatus.CONFIRMED:
            raise DomainException(status_code=400, detail="Booking has already been confirmed and paid")

        now = datetime.now(timezone.utc)

        # 3. Simulate failure flow (allows retry)
        if payment_req.simulate_failure:
            payment = Payment(
                id=str(uuid.uuid4()),
                booking_id=booking.id,
                idempotency_key=payment_req.idempotency_key,
                status=PaymentStatus.FAILED,
                amount=float(booking.fare_amount),
                simulated_reference=f"SIM-FAIL-{uuid.uuid4().hex[:6].upper()}",
                initiated_at=now
            )
            db.add(payment)
            await db.commit()
            return payment

        # 4. Atomic capacity check and demand increment (single atomic UPDATE ... WHERE demand_count + n <= capacity)
        from sqlalchemy import update
        trip_id = booking.trip_id
        seats_to_add = booking.seat_count

        update_stmt = (
            update(Trip)
            .where(Trip.id == trip_id)
            .where((Trip.demand_count + seats_to_add) <= Trip.capacity)
            .values(
                demand_count=Trip.demand_count + seats_to_add,
                updated_at=now
            )
        )
        update_result = await db.execute(update_stmt)
        if update_result.rowcount == 0:
            # Capacity exceeded
            raise TripCapacityExceededException("Cannot confirm payment: trip capacity exceeded")

        # Create successful payment
        payment = Payment(
            id=str(uuid.uuid4()),
            booking_id=booking.id,
            idempotency_key=payment_req.idempotency_key,
            status=PaymentStatus.SUCCESS,
            amount=float(booking.fare_amount),
            simulated_reference=f"SIM-TXN-{uuid.uuid4().hex[:8].upper()}",
            initiated_at=now,
            confirmed_at=now
        )
        db.add(payment)

        # Update booking
        booking.status = BookingStatus.CONFIRMED
        booking.updated_at = now

        # Refresh trip to check threshold
        trip = (await db.execute(select(Trip).where(Trip.id == trip_id))).scalar_one()

        # Check demand threshold for trip activation
        threshold = trip.min_threshold or settings.DEMAND_ACTIVATION_THRESHOLD
        if trip.status == TripStatus.AGGREGATING and trip.demand_count >= threshold:
            from app.services.state_machine import transition_trip_state
            # Transition state machine to THRESHOLD_MET
            await transition_trip_state(
                db, trip.id, TripStatus.THRESHOLD_MET, performed_by=passenger_id, reason="Demand threshold met by confirmed booking"
            )

        # If trip is ALREADY SCHEDULED, issue ticket immediately!
        if trip.status in [TripStatus.SCHEDULED, TripStatus.BOARDING]:
            await TicketService.issue_ticket_for_booking(db, booking)

        await db.commit()
        await db.refresh(payment)
        return payment

    @staticmethod
    async def get_passenger_bookings(db: AsyncSession, passenger_id: str) -> List[Booking]:
        stmt = (
            select(Booking)
            .where(Booking.passenger_id == passenger_id)
            .order_by(Booking.created_at.desc())
        )
        return (await db.execute(stmt)).scalars().all()

