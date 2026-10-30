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
    async def create_booking(db: AsyncSession, passenger_id: str, data: BookingCreate) -> Booking:
        # Fetch trip
        stmt = select(Trip).where(Trip.id == data.trip_id)
        trip = (await db.execute(stmt)).scalar_one_or_none()
        if not trip:
            raise EntityNotFoundException("Trip", data.trip_id)

        if trip.status in [TripStatus.DEPARTED, TripStatus.COMPLETED, TripStatus.CANCELLED]:
            raise DomainException(status_code=400, detail="Cannot book seats for this trip (already departed or closed)")

        if trip.demand_count + data.seat_count > trip.capacity:
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
        # Check idempotency
        stmt_idem = select(Payment).where(Payment.idempotency_key == payment_req.idempotency_key)
        existing_payment = (await db.execute(stmt_idem)).scalar_one_or_none()
        if existing_payment:
            return existing_payment

        # Fetch booking
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

        # Success flow:
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

        # Update trip demand count
        trip = booking.trip
        trip.demand_count += booking.seat_count
        trip.updated_at = now

        # Check demand threshold for trip activation
        if trip.status == TripStatus.AGGREGATING and trip.demand_count >= settings.DEMAND_ACTIVATION_THRESHOLD:
            trip.status = TripStatus.THRESHOLD_MET

        # Issue ticket with QR code
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
