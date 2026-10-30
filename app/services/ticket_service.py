import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.core.constants import TicketStatus
from app.core.security import (
    generate_qr_image_data_uri,
    generate_qr_ticket_string,
    parse_and_verify_qr_string,
)
from app.models.booking import Booking
from app.models.ticket import Ticket
from app.models.trip import Trip
from app.schemas.ticket import TicketResponse, TicketValidationResponse


class TicketService:
    @staticmethod
    async def issue_ticket_for_booking(db: AsyncSession, booking: Booking) -> Ticket:
        """Issues an HMAC-signed ticket upon successful payment confirmation"""
        ticket_id = str(uuid.uuid4())
        ref = f"TKT-{uuid.uuid4().hex[:8].upper()}"

        full_qr_str, payload_json, signature = generate_qr_ticket_string(
            ticket_id=ticket_id,
            trip_id=booking.trip_id
        )

        ticket = Ticket(
            id=ticket_id,
            booking_id=booking.id,
            passenger_id=booking.passenger_id,
            trip_id=booking.trip_id,
            ticket_reference=ref,
            qr_payload=payload_json,
            qr_signature=signature,
            status=TicketStatus.ISSUED,
            issued_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.TICKET_VALIDITY_WINDOW_HOURS)
        )
        db.add(ticket)
        await db.flush()
        return ticket

    @staticmethod
    async def get_ticket_details(db: AsyncSession, ticket_id: str) -> Optional[TicketResponse]:
        stmt = (
            select(Ticket)
            .where(Ticket.id == ticket_id)
            .options(
                selectinload(Ticket.booking).selectinload(Booking.passenger),
                selectinload(Ticket.trip).selectinload(Trip.route)
            )
        )
        result = await db.execute(stmt)
        ticket = result.scalar_one_or_none()
        if not ticket:
            return None

        # Reconstruct QR string
        import base64
        b64_payload = base64.urlsafe_b64encode(ticket.qr_payload.encode("utf-8")).decode("utf-8").rstrip("=")
        qr_string = f"{b64_payload}.{ticket.qr_signature}"
        data_uri = generate_qr_image_data_uri(qr_string)

        passenger = ticket.booking.passenger if ticket.booking else None
        route = ticket.trip.route if ticket.trip else None

        return TicketResponse(
            id=ticket.id,
            booking_id=ticket.booking_id,
            ticket_reference=ticket.ticket_reference,
            trip_id=ticket.trip_id,
            passenger_name=passenger.full_name if passenger else "Passenger",
            passenger_phone=passenger.phone if passenger else None,
            route_name=route.name if route else "Route",
            origin=route.origin if route else "",
            destination=route.destination if route else "",
            status=ticket.status,
            qr_content=qr_string,
            qr_data_url=data_uri,
            issued_at=ticket.issued_at,
            expires_at=ticket.expires_at
        )

    @staticmethod
    async def validate_qr_for_trip(
        db: AsyncSession, qr_code_str: str, expected_trip_id: str
    ) -> Tuple[bool, Optional[Ticket], str]:
        """
        Validates QR signature, decodes ticket_id, and confirms ticket matches trip and is not boarded.
        Returns: (is_valid, ticket, message)
        """
        valid_sig, data, error_msg = parse_and_verify_qr_string(qr_code_str)
        if not valid_sig or not data:
            return False, None, f"Invalid QR Signature: {error_msg}"

        ticket_id = data.get("ticket_id")
        trip_id = data.get("trip_id")

        if trip_id != expected_trip_id:
            return False, None, f"Ticket belongs to a different trip (ID: {trip_id})"

        stmt = (
            select(Ticket)
            .where(Ticket.id == ticket_id)
            .options(
                selectinload(Ticket.booking).selectinload(Booking.passenger)
            )
        )
        ticket = (await db.execute(stmt)).scalar_one_or_none()

        if not ticket:
            return False, None, "Ticket record not found in system"

        if ticket.status == TicketStatus.BOARDED:
            return False, ticket, "ALREADY BOARDED: Ticket was already scanned and passenger boarded"

        if ticket.status != TicketStatus.ISSUED:
            return False, ticket, f"Ticket cannot be boarded (status: {ticket.status.value})"

        return True, ticket, "Ticket is valid for boarding"
