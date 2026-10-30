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
    - Increments trip demand counter
    - Triggers threshold check (transitions to THRESHOLD_MET if >= 20)
    - Issues HMAC-signed QR ticket
    """
    return await BookingService.confirm_payment_and_issue_ticket(db, current_user.id, data)
