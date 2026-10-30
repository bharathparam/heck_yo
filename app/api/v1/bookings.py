from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User
from app.schemas.booking import (
    BookingCreate,
    BookingResponse,
    PaymentResponse,
    PaymentSimulationRequest,
)
from app.services.booking_service import BookingService

router = APIRouter(prefix="/bookings", tags=["Bookings"])


@router.post("", response_model=BookingResponse)
async def create_booking(
    data: BookingCreate,
    current_user: User = Depends(require_role(UserRole.PASSENGER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Creates a pending booking for a trip"""
    return await BookingService.create_booking(db, current_user.id, data)


@router.get("/my", response_model=List[BookingResponse])
async def list_my_bookings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lists bookings for currently logged-in passenger"""
    return await BookingService.get_passenger_bookings(db, current_user.id)


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking_by_id(
    booking_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves single booking details (owner or admin)"""
    from sqlalchemy import select
    from app.core.exceptions import EntityNotFoundException, ForbiddenException
    from app.models.booking import Booking

    stmt = select(Booking).where(Booking.id == booking_id)
    booking = (await db.execute(stmt)).scalar_one_or_none()
    if not booking:
        raise EntityNotFoundException("Booking", booking_id)

    if booking.passenger_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise ForbiddenException("Not authorized to view this booking")

    return booking


@router.get("/{booking_id}/ticket")
async def get_booking_ticket(
    booking_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves issued ticket details for a booking"""
    from sqlalchemy import select
    from app.core.exceptions import EntityNotFoundException, ForbiddenException
    from app.models.booking import Booking
    from app.models.ticket import Ticket
    from app.services.ticket_service import TicketService

    stmt = select(Booking).where(Booking.id == booking_id)
    booking = (await db.execute(stmt)).scalar_one_or_none()
    if not booking:
        raise EntityNotFoundException("Booking", booking_id)

    if booking.passenger_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise ForbiddenException("Not authorized to view this ticket")

    tkt_stmt = select(Ticket).where(Ticket.booking_id == booking.id)
    ticket = (await db.execute(tkt_stmt)).scalar_one_or_none()
    if not ticket:
        raise EntityNotFoundException("Ticket for booking", booking_id)

    ticket_details = await TicketService.get_ticket_details(db, ticket.id)
    return ticket_details


@router.post("/simulate-payment", response_model=PaymentResponse)
async def simulate_payment(
    data: PaymentSimulationRequest,
    current_user: User = Depends(require_role(UserRole.PASSENGER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Simulates payment for a booking.
    Upon success:
    - Confirms booking
    - Increments trip demand counter atomically
    - Triggers threshold check (transitions to THRESHOLD_MET if >= min_threshold)
    - If trip is SCHEDULED, issues HMAC-signed QR ticket
    """
    return await BookingService.confirm_payment_and_issue_ticket(db, current_user.id, data)

