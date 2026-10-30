"""
RailBus Passenger MCP Server for Claude / LLMs.

Provides direct access to RailBus transit services:
- Search bus routes & stops
- Check trips and real-time seat availability
- Book seats without requiring credentials/passwords
- Simulate payment and issue digital QR tickets
- View passenger tickets & bookings
"""

import sys
import os
import uuid
from typing import Optional, List, Dict, Any

# Ensure project root is on sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from mcp.server.mcpserver import MCPServer
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal, init_db
from app.models.user import User
from app.models.route import Route, RouteStop
from app.models.trip import Trip
from app.models.booking import Booking
from app.models.ticket import Ticket
from app.core.constants import UserRole, TripStatus, BookingStatus
from app.schemas.booking import BookingCreate, PaymentSimulationRequest
from app.services.booking_service import BookingService
from app.services.ticket_service import TicketService
from app.services.trip_service import TripService

# Initialize MCP Server
mcp = MCPServer("RailBus Passenger Service")


async def get_or_create_passenger(session, passenger_id: Optional[str] = None, email: Optional[str] = None, full_name: Optional[str] = None) -> User:
    """Helper to resolve or create a passenger without requiring credentials."""
    if passenger_id:
        user = (await session.execute(select(User).where(User.id == passenger_id))).scalar_one_or_none()
        if user:
            return user

    if email:
        user = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if user:
            return user

    # Default to first active passenger in database
    default_user = (await session.execute(
        select(User).where(User.role == UserRole.PASSENGER, User.is_active.is_(True)).order_by(User.email.asc())
    )).scalars().first()
    if default_user:
        return default_user

    # Create one if none exists
    new_user = User(
        id=str(uuid.uuid4()),
        email=email or "passenger@railbus.local",
        password_hash="nopassword_mcp_access",
        full_name=full_name or "RailBus Passenger",
        phone="+91-9876543200",
        role=UserRole.PASSENGER,
        is_active=True
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    return new_user


@mcp.tool()
async def search_routes(query: Optional[str] = None, limit: int = 15) -> List[Dict[str, Any]]:
    """
    Search available bus routes and stops.
    
    Args:
        query: Optional search keyword for route name, origin, destination, or stop (e.g. 'Electronic City', 'Central Station', 'KBS').
        limit: Maximum number of routes to return (default 15).
    """
    await init_db()
    async with AsyncSessionLocal() as session:
        stmt = (
            select(Route)
            .options(selectinload(Route.stops))
            .order_by(Route.name.asc())
            .limit(limit)
        )
        if query:
            pattern = f"%{query}%"
            stmt = stmt.where(
                or_(
                    Route.name.ilike(pattern),
                    Route.origin.ilike(pattern),
                    Route.destination.ilike(pattern)
                )
            )

        routes = (await session.execute(stmt)).scalars().all()
        results = []
        for r in routes:
            results.append({
                "route_id": r.id,
                "route_name": r.name,
                "origin": r.origin,
                "destination": r.destination,
                "distance_km": float(r.distance_km),
                "stops": [
                    {
                        "stop_order": s.stop_order,
                        "stop_name": s.stop_name,
                        "distance_km": float(s.distance_from_origin_km)
                    }
                    for s in sorted(r.stops, key=lambda x: x.stop_order)
                ]
            })
        return results


@mcp.tool()
async def list_trips(route_id: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    List bus and rail trips with live seat capacity and pricing.
    
    Args:
        route_id: Optional route ID to filter trips by.
        status: Optional status filter ('AGGREGATING', 'THRESHOLD_MET', 'SCHEDULED', 'BOARDING', 'DEPARTED').
    """
    await init_db()
    async with AsyncSessionLocal() as session:
        trip_status = None
        if status:
            try:
                trip_status = TripStatus(status)
            except ValueError:
                pass

        trips = await TripService.list_trips(session, status=trip_status, route_id=route_id)
        results = []
        for t in trips:
            available_seats = max(0, t.capacity - t.demand_count)
            results.append({
                "trip_id": t.id,
                "route_id": t.route_id,
                "route_name": t.route_name,
                "origin": t.origin,
                "destination": t.destination,
                "status": t.status.value,
                "departure_time": t.departure_time.isoformat() if t.departure_time else None,
                "base_fare": t.base_fare,
                "total_capacity": t.capacity,
                "booked_count": t.demand_count,
                "available_seats": available_seats,
                "threshold_met": t.threshold_met,
                "bus_registration": t.bus_registration,
                "conductor_name": t.conductor_name
            })
        return results


@mcp.tool()
async def get_trip_details(trip_id: str) -> Dict[str, Any]:
    """
    Get detailed information about a specific trip.
    
    Args:
        trip_id: UUID of the trip.
    """
    await init_db()
    async with AsyncSessionLocal() as session:
        trip = await TripService.get_trip_by_id(session, trip_id)
        if not trip:
            return {"error": f"Trip with ID {trip_id} not found."}

        available_seats = max(0, trip.capacity - trip.demand_count)
        return {
            "trip_id": trip.id,
            "route_id": trip.route_id,
            "route_name": trip.route.name if trip.route else None,
            "origin": trip.route.origin if trip.route else None,
            "destination": trip.route.destination if trip.route else None,
            "status": trip.status.value,
            "departure_time": trip.departure_time.isoformat() if trip.departure_time else None,
            "base_fare": float(trip.base_fare),
            "total_capacity": trip.capacity,
            "booked_count": trip.demand_count,
            "available_seats": available_seats,
            "bus_registration": trip.bus.registration_number if trip.bus else None,
            "conductor_name": trip.conductor.user.full_name if (trip.conductor and trip.conductor.user) else None
        }


@mcp.tool()
async def book_seats(trip_id: str, seat_count: int = 1, passenger_email: Optional[str] = None, passenger_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Book seats for a trip without credentials authentication.
    
    Args:
        trip_id: The ID of the trip to book.
        seat_count: Number of seats to book (default 1).
        passenger_email: Optional email to attach to the booking (defaults to the active passenger).
        passenger_name: Optional name for the passenger.
    """
    await init_db()
    async with AsyncSessionLocal() as session:
        user = await get_or_create_passenger(session, email=passenger_email, full_name=passenger_name)
        create_schema = BookingCreate(trip_id=trip_id, seat_count=seat_count)
        try:
            booking = await BookingService.create_booking(session, user.id, create_schema)
            return {
                "success": True,
                "booking_id": booking.id,
                "booking_reference": booking.booking_reference,
                "trip_id": booking.trip_id,
                "passenger_id": booking.passenger_id,
                "passenger_name": user.full_name,
                "passenger_email": user.email,
                "seat_count": booking.seat_count,
                "fare_amount": float(booking.fare_amount),
                "status": booking.status.value,
                "message": "Booking created. You can now confirm payment using confirm_payment_and_issue_ticket."
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


@mcp.tool()
async def confirm_payment_and_issue_ticket(booking_id: str, idempotency_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Confirm payment for a booking and immediately issue an HMAC-signed digital QR ticket.
    
    Args:
        booking_id: ID of the pending booking.
        idempotency_key: Optional unique idempotency key (auto-generated if omitted).
    """
    await init_db()
    async with AsyncSessionLocal() as session:
        # Fetch booking to get passenger
        b_res = await session.execute(select(Booking).where(Booking.id == booking_id))
        booking = b_res.scalar_one_or_none()
        if not booking:
            return {"success": False, "error": f"Booking with ID {booking_id} not found."}

        key = idempotency_key or f"MCP-PAY-{uuid.uuid4().hex[:12]}"
        req = PaymentSimulationRequest(booking_id=booking_id, idempotency_key=key, simulate_failure=False)

        try:
            payment = await BookingService.confirm_payment_and_issue_ticket(session, booking.passenger_id, req)
            # Fetch the generated ticket
            t_res = await session.execute(
                select(Ticket)
                .where(Ticket.booking_id == booking_id)
                .options(selectinload(Ticket.trip).selectinload(Trip.route))
            )
            ticket = t_res.scalar_one_or_none()

            ticket_details = None
            if ticket:
                ticket_details = await TicketService.get_ticket_details(session, ticket.id)

            return {
                "success": True,
                "payment_id": payment.id,
                "payment_reference": payment.simulated_reference,
                "payment_status": payment.status.value,
                "amount": float(payment.amount),
                "ticket_id": ticket.id if ticket else None,
                "ticket_reference": ticket.ticket_reference if ticket else None,
                "qr_content": ticket_details.qr_content if ticket_details else None,
                "qr_data_url": ticket_details.qr_data_url if ticket_details else None,
                "message": "Payment confirmed and ticket successfully issued! Ready for boarding scan."
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


@mcp.tool()
async def get_ticket_details(ticket_id: str) -> Dict[str, Any]:
    """
    Retrieve digital ticket details, passenger name, route, status, and verified QR code payload.
    
    Args:
        ticket_id: UUID of the ticket.
    """
    await init_db()
    async with AsyncSessionLocal() as session:
        details = await TicketService.get_ticket_details(session, ticket_id)
        if not details:
            return {"error": f"Ticket {ticket_id} not found."}
        return {
            "ticket_id": details.id,
            "ticket_reference": details.ticket_reference,
            "status": details.status.value,
            "passenger_name": details.passenger_name,
            "passenger_phone": details.passenger_phone,
            "route_name": details.route_name,
            "origin": details.origin,
            "destination": details.destination,
            "issued_at": details.issued_at.isoformat() if details.issued_at else None,
            "expires_at": details.expires_at.isoformat() if details.expires_at else None,
            "qr_content": details.qr_content,
            "qr_data_url": details.qr_data_url
        }


@mcp.tool()
async def get_my_bookings_and_tickets(passenger_email: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    View all bookings and associated tickets for the passenger.
    
    Args:
        passenger_email: Optional email to look up. If omitted, returns bookings for the default passenger.
    """
    await init_db()
    async with AsyncSessionLocal() as session:
        user = await get_or_create_passenger(session, email=passenger_email)
        stmt = (
            select(Booking)
            .where(Booking.passenger_id == user.id)
            .options(
                selectinload(Booking.trip).selectinload(Trip.route),
                selectinload(Booking.tickets)
            )
            .order_by(Booking.created_at.desc())
        )
        bookings = (await session.execute(stmt)).scalars().all()
        
        results = []
        for b in bookings:
            t = b.tickets[0] if b.tickets else None
            results.append({
                "booking_id": b.id,
                "booking_reference": b.booking_reference,
                "status": b.status.value,
                "fare_amount": float(b.fare_amount),
                "seat_count": b.seat_count,
                "route": b.trip.route.name if (b.trip and b.trip.route) else None,
                "ticket_id": t.id if t else None,
                "ticket_reference": t.ticket_reference if t else None,
                "ticket_status": t.status.value if t else None
            })
        return results


if __name__ == "__main__":
    mcp.run()
