import uuid
from typing import Optional
from sqlalchemy import String, Integer, Boolean, Numeric, Float, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.core.constants import RouteType


class Route(Base):
    __tablename__ = "routes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    origin: Mapped[str] = mapped_column(String(255), nullable=False)
    destination: Mapped[str] = mapped_column(String(255), nullable=False)
    distance_km: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    route_type: Mapped[RouteType] = mapped_column(
        SAEnum(RouteType), default=RouteType.CITY, nullable=False, index=True
    )
    base_fare: Mapped[float] = mapped_column(Numeric(10, 2), default=50.00, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    stops = relationship("RouteStop", back_populates="route", order_by="RouteStop.stop_order", cascade="all, delete-orphan")
    train_arrivals = relationship("TrainArrival", back_populates="route")
    trips = relationship("Trip", back_populates="route")


class RouteStop(Base):
    __tablename__ = "route_stops"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    route_id: Mapped[str] = mapped_column(String(36), ForeignKey("routes.id"), nullable=False)
    stop_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stop_order: Mapped[int] = mapped_column(Integer, nullable=False)
    distance_from_origin_km: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    fare_from_origin: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)

    route = relationship("Route", back_populates="stops")

