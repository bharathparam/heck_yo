import uuid
from datetime import datetime, date, timezone
from typing import Optional
from sqlalchemy import (
    String,
    Integer,
    Numeric,
    DateTime,
    Date,
    Enum as SAEnum,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.core.constants import TripStatus


class Trip(Base):
    __tablename__ = "trips"
    __table_args__ = (
        UniqueConstraint("train_arrival_id", "route_id", "travel_date", name="uq_trip_train_route_date"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    route_id: Mapped[str] = mapped_column(String(36), ForeignKey("routes.id"), nullable=False)
    train_arrival_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("train_arrivals.id"), nullable=True)
    bus_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("buses.id"), nullable=True)
    conductor_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("conductors.id"), nullable=True)
    approved_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)

    status: Mapped[TripStatus] = mapped_column(
        SAEnum(TripStatus), default=TripStatus.AGGREGATING, index=True, nullable=False
    )
    demand_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, default=40, nullable=False)
    min_threshold: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    boarded_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    base_fare: Mapped[float] = mapped_column(Numeric(10, 2), default=50.00, nullable=False)
    travel_date: Mapped[date] = mapped_column(Date, default=lambda: datetime.now(timezone.utc).date(), nullable=False, index=True)
    departure_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    deadline_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    route = relationship("Route", back_populates="trips")
    train_arrival = relationship("TrainArrival", back_populates="trips")
    bus = relationship("Bus", back_populates="trips")
    conductor = relationship("Conductor", back_populates="trips")
    bookings = relationship("Booking", back_populates="trip")
    tickets = relationship("Ticket", back_populates="trip")
    boarding_records = relationship("BoardingRecord", back_populates="trip")
    audit_logs = relationship("AuditLog", back_populates="trip")

