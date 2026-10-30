import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import (
    AuditAction,
    BookingStatus,
    NotificationType,
    PaymentStatus,
    TicketStatus,
    TripStatus,
)
from app.core.exceptions import (
    EntityNotFoundException,
    InvalidStateTransitionException,
)
from app.models.audit import AuditLog
from app.models.booking import Booking, Payment
from app.models.notification import Notification
from app.models.ticket import Ticket
from app.models.trip import Trip


VALID_TRIP_TRANSITIONS = {
    TripStatus.AGGREGATING: [TripStatus.THRESHOLD_MET, TripStatus.CANCELLED],
    TripStatus.THRESHOLD_MET: [TripStatus.SCHEDULED, TripStatus.CANCELLED],
    TripStatus.SCHEDULED: [TripStatus.BOARDING, TripStatus.CANCELLED],
    TripStatus.BOARDING: [TripStatus.DEPARTED, TripStatus.CANCELLED],
    TripStatus.DEPARTED: [TripStatus.COMPLETED],
    TripStatus.COMPLETED: [],
    TripStatus.CANCELLED: [],
}


async def transition_trip_state(
    db: AsyncSession,
    trip_id: str,
    target_status: TripStatus,
    performed_by: Optional[str] = None,
    reason: Optional[str] = None,
) -> Trip:
    """
    Centralized state machine for all Trip state transitions.
    Enforces valid state rules, writes audit logs, issues tickets upon SCHEDULED,
    and handles refunds/cancellations when CANCELLED.
    """
    stmt = (
        select(Trip)
        .where(Trip.id == trip_id)
        .options(
            selectinload(Trip.route),
            selectinload(Trip.bus),
            selectinload(Trip.conductor),
            selectinload(Trip.bookings).selectinload(Booking.payments),
            selectinload(Trip.bookings).selectinload(Booking.tickets),
            selectinload(Trip.bookings).selectinload(Booking.passenger),
        )
    )
    trip = (await db.execute(stmt)).scalar_one_or_none()
    if not trip:
        raise EntityNotFoundException("Trip", trip_id)

    current_status = trip.status
    if current_status == target_status:
        return trip

    allowed = VALID_TRIP_TRANSITIONS.get(current_status, [])
    if target_status not in allowed:
        raise InvalidStateTransitionException(current_status.value, target_status.value)

    now = datetime.now(timezone.utc)
    from_state_str = current_status.value
    to_state_str = target_status.value

    # Execute State-specific Actions
    if target_status == TripStatus.SCHEDULED:
        # Issue tickets for all CONFIRMED bookings that don't have an issued ticket yet
        from app.services.ticket_service import TicketService
        for booking in trip.bookings:
            if booking.status == BookingStatus.CONFIRMED:
                # Check if ticket already exists
                if not booking.tickets:
                    await TicketService.issue_ticket_for_booking(db, booking)
                # Send notification to passenger
                notif = Notification(
                    id=str(uuid.uuid4()),
                    user_id=booking.passenger_id,
                    trip_id=trip.id,
                    title="Trip Scheduled & Ticket Issued!",
                    message=f"Your trip on route '{trip.route.name if trip.route else ''}' is now scheduled. Bus registration: {trip.bus.registration_number if trip.bus else 'Assigned'}.",
                    notification_type=NotificationType.TRIP_SCHEDULED,
                    created_at=now,
                )
                db.add(notif)

    elif target_status == TripStatus.CANCELLED:
        # Cancel bookings, simulate refunds, cancel tickets
        for booking in trip.bookings:
            if booking.status in [BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT]:
                booking.status = BookingStatus.CANCELLED
                booking.updated_at = now

                # Mark payment refunded if confirmed
                for payment in booking.payments:
                    if payment.status == PaymentStatus.SUCCESS:
                        payment.status = PaymentStatus.REFUNDED
                        payment.refunded_at = now

                # Cancel any issued tickets
                for ticket in booking.tickets:
                    if ticket.status == TicketStatus.ISSUED:
                        ticket.status = TicketStatus.CANCELLED

                # Notify passenger of cancellation and refund
                notif = Notification(
                    id=str(uuid.uuid4()),
                    user_id=booking.passenger_id,
                    trip_id=trip.id,
                    title="Trip Cancelled - Full Refund Initiated",
                    message=f"Trip on route '{trip.route.name if trip.route else ''}' was cancelled. Reason: {reason or 'Demand threshold not reached or operational cancellation'}. Your payment has been marked for full simulated refund.",
                    notification_type=NotificationType.PAYMENT_REFUNDED,
                    created_at=now,
                )
                db.add(notif)

    elif target_status == TripStatus.BOARDING:
        for booking in trip.bookings:
            if booking.status == BookingStatus.CONFIRMED:
                notif = Notification(
                    id=str(uuid.uuid4()),
                    user_id=booking.passenger_id,
                    trip_id=trip.id,
                    title="Boarding Now Open",
                    message="The conductor has opened the boarding window for your trip. Please show your QR ticket.",
                    notification_type=NotificationType.BOARDING_OPEN,
                    created_at=now,
                )
                db.add(notif)

    # Update trip status
    trip.status = target_status
    trip.updated_at = now

    # Record Audit Log
    audit = AuditLog(
        id=str(uuid.uuid4()),
        trip_id=trip.id,
        performed_by=performed_by,
        action=AuditAction.STATE_TRANSITION,
        from_state=from_state_str,
        to_state=to_state_str,
        details=reason or f"Transitioned from {from_state_str} to {to_state_str}",
        timestamp=now,
    )
    db.add(audit)

    await db.commit()
    await db.refresh(trip)
    return trip
