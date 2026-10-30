import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Enum as SAEnum, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.core.constants import TicketStatus


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    booking_id: Mapped[str] = mapped_column(String(36), ForeignKey("bookings.id"), unique=True, nullable=False)
    passenger_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    trip_id: Mapped[str] = mapped_column(String(36), ForeignKey("trips.id"), nullable=False)
    ticket_reference: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)

    # QR details: raw JSON and HMAC signature
    qr_payload: Mapped[str] = mapped_column(Text, nullable=False)
    qr_signature: Mapped[str] = mapped_column(String(128), nullable=False)

    status: Mapped[TicketStatus] = mapped_column(
        SAEnum(TicketStatus), default=TicketStatus.ISSUED, index=True, nullable=False
    )
    issued_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Relationships
    booking = relationship("Booking", back_populates="ticket")
    trip = relationship("Trip", back_populates="tickets")
    boarding_record = relationship("BoardingRecord", back_populates="ticket", uselist=False)


class BoardingRecord(Base):
    __tablename__ = "boarding_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id: Mapped[str] = mapped_column(String(36), ForeignKey("tickets.id"), unique=True, nullable=False)
    trip_id: Mapped[str] = mapped_column(String(36), ForeignKey("trips.id"), nullable=False)
    conductor_id: Mapped[str] = mapped_column(String(36), ForeignKey("conductors.id"), nullable=False)
    passenger_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    boarded_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    scan_device_id: Mapped[str] = mapped_column(String(100), nullable=True)

    ticket = relationship("Ticket", back_populates="boarding_record")
    trip = relationship("Trip", back_populates="boarding_records")
    conductor = relationship("Conductor", back_populates="boardings")
