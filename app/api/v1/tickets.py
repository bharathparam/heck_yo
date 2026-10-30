from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import EntityNotFoundException
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.ticket import (
    TicketResponse,
    TicketValidationRequest,
    TicketValidationResponse,
)
from app.services.ticket_service import TicketService

router = APIRouter(prefix="/tickets", tags=["Tickets"])


@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves ticket details including rendered QR code PNG data URL"""
    ticket_data = await TicketService.get_ticket_details(db, ticket_id)
    if not ticket_data:
        raise EntityNotFoundException("Ticket", ticket_id)
    return ticket_data


@router.post("/validate", response_model=TicketValidationResponse)
async def validate_ticket_qr(
    data: TicketValidationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Verifies HMAC signature of a scanned QR string against trip"""
    is_valid, ticket, msg = await TicketService.validate_qr_for_trip(
        db, data.qr_code, data.trip_id
    )

    p_name = None
    p_phone = None
    if ticket and ticket.booking and ticket.booking.passenger:
        p_name = ticket.booking.passenger.full_name
        p_phone = ticket.booking.passenger.phone

    return TicketValidationResponse(
        valid=is_valid,
        ticket_id=ticket.id if ticket else None,
        ticket_reference=ticket.ticket_reference if ticket else None,
        passenger_name=p_name,
        passenger_phone=p_phone,
        status=ticket.status.value if ticket else None,
        message=msg
    )
